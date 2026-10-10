const express = require("express");
const multer = require("multer");
const path = require("path");
const dotenv = require("dotenv");
const { requireAdmin } = require("../middleware/require-admin");

dotenv.config();

const router = express.Router();
router.use(requireAdmin);

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, "../../frontend/public/uploads"),
    filename: (req, file, cb) => {
      const uniqueName = `${file.originalname}-${Date.now()}`;
      cb(null, uniqueName);
    }
  })
});

// Upload image
router.post("/image", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Image file required" });
  }

  const repoPath = `uploads/${req.file.filename}`;
  res.json({
    success: true,
    repoPath,
    url: `${process.env.IMAGE_REPO_URL}/${req.file.filename}`
  });
});

// Upload document (PDF, specs, cutlist)
router.post("/document", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Document file required" });
  }

  const repoPath = `uploads/docs/${req.file.filename}`;
  res.json({
    success: true,
    repoPath,
    url: `${process.env.IMAGE_REPO_URL}/docs/${req.file.filename}`
  });
});

// Upload video (product demo)
router.post("/video", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Video file required" });
  }

  const repoPath = `uploads/videos/${req.file.filename}`;
  res.json({
    success: true,
    repoPath,
    url: `${process.env.IMAGE_REPO_URL}/videos/${req.file.filename}`
  });
});

module.exports = router;
