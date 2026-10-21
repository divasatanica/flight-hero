import { Simulation } from "./simulation";
import { createServer } from "./server";

/**
 * Load environment variables
 */
const PORT = parseInt(process.env.PORT || "4000", 10);
const PLANES_COUNT = parseInt(process.env.PLANES_COUNT || "20", 10);
const BASIC_UPDATE_INTERVAL_MS = parseInt(
  process.env.BASIC_UPDATE_INTERVAL_MS || "1000",
  10,
);
const DETAILED_UPDATE_INTERVAL_MS = parseInt(
  process.env.DETAILED_UPDATE_INTERVAL_MS || "1000",
  10,
);

/**
 * Main entry point
 */
function main() {
  console.log("🚀 Starting Flight Radar Backend...");
  console.log(`📊 Configuration:`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Planes: ${PLANES_COUNT}`);
  console.log(`   Basic update interval: ${BASIC_UPDATE_INTERVAL_MS}ms`);
  console.log(`   Detailed update interval: ${DETAILED_UPDATE_INTERVAL_MS}ms`);

  // Initialize simulation
  const simulation = new Simulation();
  simulation.initialize(PLANES_COUNT);
  console.log(`✅ Initialized ${PLANES_COUNT} planes`);

  // Create and start WebSocket server
  const wss = createServer(
    PORT,
    simulation,
    BASIC_UPDATE_INTERVAL_MS,
    DETAILED_UPDATE_INTERVAL_MS,
  );

  wss.on("listening", () => {
    console.log(`🌐 WebSocket server listening on ws://localhost:${PORT}`);
    console.log(`   Endpoints:`);
    console.log(`   - ws://localhost:${PORT}/ws/planes/basic`);
    console.log(`   - ws://localhost:${PORT}/ws/planes/details`);
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down...");
    wss.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 Shutting down...");
    wss.close(() => {
      console.log("✅ Server closed");
      process.exit(0);
    });
  });
}

main();
