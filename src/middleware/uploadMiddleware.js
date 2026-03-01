const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Generate unique filename with timestamp and random hash
const generateUniqueFilename = (originalName) => {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  return `${timestamp}_${randomHash}_${baseName}${ext}`;
};

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'), false);
  }
};

// Multer configuration for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter
});

// Middleware to validate required fields
const validateUploadFields = (req, res, next) => {
  const { userId, projectId, folderType } = req.body;
  
  if (!userId || !projectId || !folderType) {
    return res.status(400).json({
      success: false,
      message: 'userId, projectId, and folderType are required'
    });
  }

  const allowedFolderTypes = ['recce-images', 'installation-images', 'banners', 'invoices', 'reports'];
  if (!allowedFolderTypes.includes(folderType)) {
    return res.status(400).json({
      success: false,
      message: 'folderType must be one of: recce-images, installation-images, banners, invoices, reports'
    });
  }

  next();
};

module.exports = {
  upload,
  validateUploadFields,
  generateUniqueFilename
};