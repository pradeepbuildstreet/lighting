"use strict";

const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { loadConfig } = require("./config/runtime");
const config = loadConfig();

const { pool, query } = require("./db/database");
const catalogue = require("./db/catalogue");
const {
  checkImplementationReadiness,
} = require("./services/implementation-readiness");

const app = express();

let server;
let shuttingDown = false;
let readinessTimer = null;
let readinessInFlight = null;

const readiness = {
  ready: false,
  phase: "starting",
  lastCheckedAt: null,
};

app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);

app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || config.origins.includes(origin));
    },
    credentials: true,
  })
);

/*
 * Liveness: the HTTP process is running.
 * This does not mean the database/schema is ready.
 */
app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store").json({
    status: "ok",
    release: "1A",
  });
});

/*
 * Readiness: normal application traffic may be accepted.
 * Uses the background check result instead of starting another
 * database/schema check for every probe.
 */
app.get("/api/ready", (_req, res) => {
  res
    .status(readiness.ready ? 200 : 503)
    .set("Cache-Control", "no-store")
    .json({
      status: readiness.ready ? "ready" : "not_ready",
      phase: readiness.phase,
      checks: "application_and_catalogue_schema",
      lastCheckedAt: readiness.lastCheckedAt,
    });
});

/*
 * Health/readiness probes are registered above this gate.
 * All application routes below remain unavailable until the
 * existing database/schema checks have passed.
 */
app.use((_req, res, next) => {
  if (readiness.ready && !shuttingDown) {
    return next();
  }

  return res
    .status(503)
    .set({
      "Cache-Control": "no-store",
      "Retry-After": "5",
    })
    .json({
      error: "Application is not ready",
      status: "not_ready",
    });
});

app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: false,
    limit: "1mb",
  })
);

// Existing uploads remain available.
app.use(
  "/public",
  express.static(path.join(__dirname, "../frontend/public"), {
    dotfiles: "deny",
  })
);

// Retired APIs must never read/write the legacy catalogue.
app.use(
  [
    "/api/products",
    "/api/search",
    "/api/categories",
    "/api/excel-import",
    "/api/seo",
    "/api/upload",
  ],
  (_req, res) =>
    res.status(410).set("Cache-Control", "no-store").json({
      error:
        "Legacy catalogue API retired. Use /api/catalogue or /api/admin/catalogue.",
    })
);

for (const [mount, file] of [
  ["/api/auth", "auth"],
  ["/api/wishlists", "wishlists"],
  ["/api/offers", "offers"],
]) {
  app.use(mount, require(`./api/${file}`));
}

app.use(
  "/api/catalogue",
  require("./api/public-catalogue-v1").createRouter(
    express,
    catalogue,
    require("express-rate-limit")
  )
);

app.use(
  "/api/admin/catalogue",
  require("./api/catalogue-admin")
);

// Optional authenticated read-only SEO connector.
// Existing catalogue publication rules remain authoritative.
app.use(
  "/api/seo-connector",
  require("./api/seo-connector.cjs").createRouter(
    express,
    require("./services/public-catalogue-v1").createService(catalogue)
  )
);

require("./api/homepage-collections").mount(app);
require("./services/public-enquiry-counts").mount(app);
require("./services/compatibility-assessments").mount(app);

app.use((error, req, res, next) => {
  console.error(
    JSON.stringify({
      event: "request_failed",
      method: req.method,
      path: req.path,
      code: error.code || error.type || "ERROR",
    })
  );

  if (res.headersSent) {
    return next(error);
  }

  const status =
    error.status === 413
      ? 413
      : error.status === 400
        ? 400
        : 500;

  return res.status(status).json({
    error:
      status === 413
        ? "Request too large"
        : status === 400
          ? "Invalid request"
          : "Internal server error",
  });
});

async function checkDatabaseConnections() {
  return checkImplementationReadiness({ query }, catalogue);
}

/*
 * Runs one readiness check at a time.
 * Failed checks keep application traffic blocked.
 * Periodic checks also detect failure and recovery after startup.
 */
function refreshReadiness() {
  if (shuttingDown) {
    return Promise.resolve();
  }

  if (readinessInFlight) {
    return readinessInFlight;
  }

  if (!readiness.ready) {
    readiness.phase = "checking";
  }

  readinessInFlight = Promise.resolve()
    .then(() => checkDatabaseConnections())
    .then(() => {
      if (shuttingDown) {
        return;
      }

      const becameReady = !readiness.ready;

      readiness.ready = true;
      readiness.phase = "ready";
      readiness.lastCheckedAt = new Date().toISOString();

      if (becameReady) {
        console.log(
          JSON.stringify({
            event: "application_ready",
          })
        );
      }
    })
    .catch((error) => {
      if (shuttingDown) {
        return;
      }

      readiness.ready = false;
      readiness.phase = "checks_failed";
      readiness.lastCheckedAt = new Date().toISOString();

      // Do not log database URLs, passwords, or raw error objects.
      console.error(
        JSON.stringify({
          event: "readiness_failed",
          connection: error.connectionCheck || "unknown",
          code: error.code || "CONFIG_ERROR",
        })
      );
    })
    .finally(() => {
      readinessInFlight = null;

      if (!shuttingDown) {
        readinessTimer = setTimeout(refreshReadiness, 30000);
        readinessTimer.unref();
      }
    });

  return readinessInFlight;
}

async function closeDatabaseConnections() {
  try {
    await catalogue.close();
  } finally {
    await pool.end();
  }
}

async function start() {
  if (shuttingDown) {
    throw new Error("Cannot start while shutting down");
  }

  if (server) {
    return server;
  }

  /*
   * Register the HTTP listener before waiting for remote PostgreSQL.
   * The readiness middleware still prevents application access.
   */
  server = app.listen(config.port, config.host, () => {
    console.log(
      `API listening on ${config.host}:${config.port}; readiness checks pending`
    );

    void refreshReadiness();
  });

  server.on("error", (error) => {
    console.error(
      JSON.stringify({
        event: "listen_failed",
        code: error.code || "ERROR",
      })
    );

    process.exitCode = 1;

    stop().catch((shutdownError) => {
      console.error(
        JSON.stringify({
          event: "shutdown_failed",
          code: shutdownError.code || "ERROR",
        })
      );
    });
  });

  return server;
}

async function stop() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  readiness.ready = false;
  readiness.phase = "stopping";

  if (readinessTimer) {
    clearTimeout(readinessTimer);
    readinessTimer = null;
  }

  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();

  try {
    if (server && server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    await closeDatabaseConnections();
  } finally {
    clearTimeout(timer);
  }
}

/*
 * Retain normal local execution:
 * node server.js / npm start
 *
 * Hostinger uses hostinger.cjs instead, which starts explicitly
 * even when the hosting loader imports its entry module.
 */
if (require.main === module) {
  start().catch(async (error) => {
    console.error(
      JSON.stringify({
        event: "startup_failed",
        connection: error.connectionCheck || "unknown",
        code: error.code || "CONFIG_ERROR",
      })
    );

    process.exitCode = 1;

    try {
      await stop();
    } catch (shutdownError) {
      console.error(
        JSON.stringify({
          event: "shutdown_failed",
          code: shutdownError.code || "ERROR",
        })
      );
    }
  });

  const handleSignal = () => {
    stop().catch((error) => {
      process.exitCode = 1;

      console.error(
        JSON.stringify({
          event: "shutdown_failed",
          code: error.code || "ERROR",
        })
      );
    });
  };

  process.once("SIGTERM", handleSignal);
  process.once("SIGINT", handleSignal);
}

module.exports = {
  app,
  start,
  stop,
};