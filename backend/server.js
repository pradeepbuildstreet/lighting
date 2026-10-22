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
const {checkImplementationReadiness} = require("./services/implementation-readiness");

const app = express();

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
app.use([
  '/api/products', '/api/search', '/api/categories',
  '/api/excel-import', '/api/seo', '/api/upload'
], (_req,res)=>res.status(410).set('Cache-Control','no-store').json({
  error:'Legacy catalogue API retired. Use /api/catalogue or /api/admin/catalogue.'
}));

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

// Optional authenticated read-only SEO connector; catalogue rules stay authoritative.
app.use('/api/seo-connector', require('./api/seo-connector.cjs').createRouter(
  express, require('./services/public-catalogue-v1').createService(catalogue)
));

require("./api/homepage-collections").mount(app);

require("./services/public-enquiry-counts").mount(app);
require("./services/compatibility-assessments").mount(app);
app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store").json({
    status: "ok",
    release: "1A",
  });
});

async function checkDatabaseConnections() {
  return checkImplementationReadiness({query}, catalogue);
}

app.get("/api/ready", async (_req, res) => {
  try {
    await checkDatabaseConnections();

    res.set("Cache-Control", "no-store").json({
      status: "ready",
      checks: "application_and_catalogue_schema",
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "readiness_failed",
        connection: error.connectionCheck || "unknown",
        code: error.code || "CONFIG_ERROR",
      })
    );

    res.status(503).set("Cache-Control", "no-store").json({
      status: "not_ready",
    });
  }
});

app.use((error, req, res, _next) => {
  console.error(
    JSON.stringify({
      event: "request_failed",
      method: req.method,
      path: req.path,
      code: error.code || error.type || "ERROR",
    })
  );

  const status =
    error.status === 413
      ? 413
      : error.status === 400
        ? 400
        : 500;

  res.status(status).json({
    error:
      status === 413
        ? "Request too large"
        : status === 400
          ? "Invalid request"
          : "Internal server error",
  });
});

let server;
let shuttingDown = false;

async function closeDatabaseConnections() {
  try {
    await catalogue.close();
  } finally {
    await pool.end();
  }
}

async function start() {
  // Verify current application/catalogue schema before accepting requests.
  await checkDatabaseConnections();

  server = app.listen(config.port, config.host, () => {
    console.log(`API listening on ${config.host}:${config.port}`);
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
}

async function stop() {
  if (shuttingDown) return;
  shuttingDown = true;

  const timer = setTimeout(() => process.exit(1), 10000);
  timer.unref();

  try {
    if (server && server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }

    await closeDatabaseConnections();
  } finally {
    clearTimeout(timer);
  }
}

if (require.main === module) {
  start().catch(async (error) => {
    console.error(
      JSON.stringify({
        event: "startup_failed",
        connection: error.connectionCheck || "unknown",
        code: error.code || "CONFIG_ERROR",
        message: "Check database connections and runtime configuration",
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