"use strict";

const { start, stop } = require("./server.js");

/*
 * Start unconditionally when Hostinger loads this entry.
 * Do not wrap this call in require.main === module.
 */
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