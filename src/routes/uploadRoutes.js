const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { upload, validateUploadFields } = require('../middleware/uploadMiddleware');

// Upload single file
router.post('/upload', 
  upload.single('file'), 
  validateUploadFields, 
  uploadController.uploadFile
);

// Upload multiple files
router.post('/upload-multiple', 
  upload.array('files', 10), 
  validateUploadFields, 
  uploadController.uploadMultipleFiles
);

// Delete file
router.delete('/delete/:folderType/:userId/:projectId/:fileName', 
  uploadController.deleteFile
);

// Get file URL
router.get('/url/:folderType/:userId/:projectId/:fileName', 
  uploadController.getFileUrl
);

module.exports = router;