const express = require("express");
const multer = require("multer");
const ExcelJS = require("exceljs");
const path = require("path");
const dotenv = require("dotenv");
const { query, bulkInsertProducts } = require("../db/database");
const { requireAdmin } = require("../middleware/require-admin");
const { validateProduct } = require("../validators/product-validator");

dotenv.config();

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "../../frontend/public/uploads"),
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/excel",
      "application/x-excel",
    ];
    const allowedExt = [".xls", ".xlsx", ".xlsm"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xls and .xlsx Excel files allowed"), false);
    }
  },
});

const COMPULSORY_COLUMNS = [
  "sku",
  "name",
  "price",
  "category",
  "wattage",
  "lumens",
  "color_temperature",
  "material",
  "style",
  "image_repo_path",
];

function cleanHeader(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .trim();
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value.text !== undefined) return String(value.text).trim();
  if (typeof value === "object" && value.richText) return value.richText.map((x) => x.text).join("").trim();
  return String(value).trim();
}

router.post("/import-excel", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Excel file required (.xls or .xlsx)" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ error: "No worksheet found in Excel file" });
    }

    const rows = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const rowData = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        rowData[colNumber - 1] = normalizeCellValue(cell.value);
      });
      rows.push(rowData);
    });

    if (!rows.length) {
      return res.status(400).json({ error: "Excel file is empty" });
    }

    const headerRow = rows[0].map(cleanHeader).filter((h) => h !== "");
    const missingCompulsory = COMPULSORY_COLUMNS.filter((col) => !headerRow.includes(col));

    if (missingCompulsory.length > 0) {
      return res.status(400).json({
        error: "Missing compulsory columns in Excel",
        missing: missingCompulsory,
        required: COMPULSORY_COLUMNS,
        received: headerRow,
      });
    }

    const categoriesResult = await query(`SELECT id, slug FROM categories`);
    const categoryMap = new Map(
      categoriesResult.rows.map((c) => [String(c.slug).trim().toLowerCase(), c.id])
    );

    const products = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every((cell) => cell === "")) continue;

      const productData = {};
      headerRow.forEach((col, idx) => {
        productData[col] = row[idx] ?? "";
      });

      const validation = validateProduct(productData, COMPULSORY_COLUMNS);
      if (validation.errors.length > 0) {
        errors.push({
          row: i + 1,
          sku: productData.sku || `Row ${i + 1}`,
          errors: validation.errors,
        });
        continue;
      }

      const categorySlug = String(productData.category || "").trim().toLowerCase();
      const categoryId = categoryMap.get(categorySlug);

      if (!categoryId) {
        errors.push({
          row: i + 1,
          sku: productData.sku || `Row ${i + 1}`,
          errors: [`Unknown category slug: ${productData.category}`],
        });
        continue;
      }

      const smartCompatible =
        String(productData.smart_compatible).trim().toLowerCase() === "true";

      products.push({
        sku: String(productData.sku).trim(),
        name: String(productData.name).trim(),
        description: productData.description ? String(productData.description).trim() : "",
        price: parseFloat(productData.price),
        category_id: categoryId,
        wattage: parseFloat(productData.wattage),
        lumens: parseInt(productData.lumens, 10),
        color_temperature: parseInt(productData.color_temperature, 10),
        material: String(productData.material).trim(),
        style: String(productData.style).trim(),
        image_repo_path: String(productData.image_repo_path).trim(),
        image_url: `${process.env.IMAGE_REPO_URL}/${String(productData.image_repo_path).trim()}`,
        optional_attributes: {
          brand: productData.brand ? String(productData.brand).trim() : null,
          ip_rating: productData.ip_rating ? parseInt(productData.ip_rating, 10) : null,
          voltage: productData.voltage ? parseInt(productData.voltage, 10) : null,
          beam_angle: productData.beam_angle ? parseInt(productData.beam_angle, 10) : null,
          mounting_type: productData.mounting_type ? String(productData.mounting_type).trim() : null,
          smart_compatible: smartCompatible,
          warranty: productData.warranty ? String(productData.warranty).trim() : null,
        },
      });
    }

    if (products.length === 0) {
      return res.status(400).json({ error: "No valid products found", errors });
    }

    const inserted = await bulkInsertProducts(products);

    res.json({
      success: true,
      imported: inserted.length,
      errors,
      totalRows: rows.length - 1,
    });
  } catch (error) {
    console.error("Excel import error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;