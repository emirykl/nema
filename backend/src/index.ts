import { serve } from "@hono/node-server";
import { app } from "./api/routes.js";
import { config } from "./config.js";
import { startActivity } from "./indexer/activity.js";
import { startSnapshots } from "./indexer/snapshots.js";
import { startKeeper } from "./keeper/keeper.js";
import { logger } from "./lib/log.js";

const log = logger("nema");

const timers = [startSnapshots(), startActivity()];
if (config.KEEPER_ENABLED) timers.push(startKeeper());

const server = serve({ fetch: app.fetch, port: config.PORT }, ({ port }) => {
  log.info(`API on http://localhost:${port} · vault ${config.deployment.contracts.vault} (${config.deployment.network})`);
});

const shutdown = () => {
  timers.forEach(clearInterval);
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
