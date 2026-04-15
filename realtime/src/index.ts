/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting, you can see "Raw usage" from the documentation.
 * 
 * See: https://docs.colyseus.io/server
 */
import { listen } from "@colyseus/tools";

// Import Colyseus config
import app from "./app.config.js";
import { shutdownRealtimeServices } from "./services/runtimeServices.js";

// Create and listen on 2567 (or PORT environment variable.)
listen(app);

const shutdownRealtimeAppServices = () => {
  void shutdownRealtimeServices();
};

process.once("SIGINT", shutdownRealtimeAppServices);
process.once("SIGTERM", shutdownRealtimeAppServices);
