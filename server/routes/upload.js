const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure images directory exists
const imagesDir = path.join(__dirname, '../../images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  if (process.env.NODE_ENV === 'development') {
    console.log('[Upload] Created images directory:', imagesDir);
  }
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp + original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `img-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// POST /api/upload - Upload an image
router.post('/', upload.single('image'), (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Upload] Received file:', req.file ? req.file.filename : 'none');
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Make sure the form field is named "image".' });
    }

    // Return the filename (relative path)
    res.json({
      success: true,
      filename: req.file.filename,
      path: `/images/${req.file.filename}`,
      size: req.file.size
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    next(error);
  }
});

module.exports = router;
