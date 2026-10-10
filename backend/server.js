const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const productApi = require("./api/products");
const searchApi = require("./api/search");
const uploadApi = require("./api/upload");
const excelImportApi = require("./api/excel-import");
const seoApi = require("./api/seo");
const categoriesApi = require("./api/categories");
const wishlistsApi = require("./api/wishlists");
const authApi = require("./api/auth");
const offersApi = require("./api/offers");

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.set("trust proxy", 1);

// Middleware
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "../frontend/public")));

// Routes
app.use("/api/auth", authApi);
app.use("/api/products", productApi);
app.use("/api/search", searchApi);
app.use("/api/upload", uploadApi);
app.use("/api/excel-import", excelImportApi);
app.use("/api/seo", seoApi);
app.use("/api/categories", categoriesApi);
app.use("/api/wishlists", wishlistsApi);
app.use("/api/offers", offersApi);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
