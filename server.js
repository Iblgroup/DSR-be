import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testConnection } from "./config/database.js";
import { config } from "./config/config.js";
import apiRoutes from "./routes/api.js";

dotenv.config();

const app = express();
const PORT = config.server.port;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root route - API info
app.get("/", (req, res) => {
  res.json({
    name: "Distribution Metrics Backend API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    environment: config.server.env,
    endpoints: {
      health: "/health",
      api: {
        productData: "/api/product-data",
        salesSummary: "/api/sales-summary",
        dailySalesAvg: "/api/daily-sales-avg",
        mtdSalesDetail: "/api/mtd-sales-detail",
      },
    },
  });
});

// Health check route
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: config.server.env,
  });
});

// API routes
app.use("/api", apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(config.server.env === "development" && { stack: err.stack }),
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error(
        "❌ Failed to connect to database. Please check your configuration."
      );
      console.log("\n📝 Steps to set up:");
      console.log("1. Copy .env.example to .env");
      console.log("2. Update database credentials in .env");
      console.log(
        "3. Run: npm run generate-models (to generate models from your database)"
      );
      console.log("4. Run: npm start\n");
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log("\n🚀 Server is running!");
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
      console.log(`📊 API: http://localhost:${PORT}/api`);
      console.log(`🌍 Environment: ${config.server.env}\n`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
