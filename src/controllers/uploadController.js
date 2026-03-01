const fs = require('fs');
const path = require('path');
const FTPClient = require('../config/ftpClient');
const { generateUniqueFilename } = require('../middleware/uploadMiddleware');

class UploadController {
  // Upload single file
  async uploadFile(req, res) {
    const ftpClient = new FTPClient();
    let tempFilePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const { userId, projectId, folderType } = req.body;
      const uniqueFileName = generateUniqueFilename(req.file.originalname);
      
      // Create temp file
      tempFilePath = path.join(__dirname, '../../temp', uniqueFileName);
      fs.writeFileSync(tempFilePath, req.file.buffer);

      // Connect to FTP
      await ftpClient.connect();

      // Create directory structure: /uploads/folderType/userId/projectId/
      const remotePath = `${process.env.BASE_PUBLIC_PATH}/${folderType}/${userId}/${projectId}`;
      await ftpClient.ensureDir(remotePath);

      // Upload file
      const remoteFilePath = `${remotePath}/${uniqueFileName}`;
      await ftpClient.uploadFile(tempFilePath, remoteFilePath);

      // Close FTP connection
      await ftpClient.close();

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      const publicUrl = `${process.env.BASE_PUBLIC_URL}/${folderType}/${userId}/${projectId}/${uniqueFileName}`;

      res.json({
        success: true,
        fileName: uniqueFileName,
        path: `/${folderType}/${userId}/${projectId}/${uniqueFileName}`,
        url: publicUrl,
        fileId: uniqueFileName.split('_')[1] // Return hash as unique ID
      });

    } catch (error) {
      // Clean up on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      await ftpClient.close();

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Upload multiple files
  async uploadMultipleFiles(req, res) {
    const ftpClient = new FTPClient();
    const tempFiles = [];
    const uploadedFiles = [];

    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const { clientCode, storeId, folderType } = req.body;

      // Connect to FTP
      await ftpClient.connect();

      // Create directory structure
      const remotePath = `${process.env.BASE_PUBLIC_PATH}/${clientCode}/${storeId}/${folderType}`;
      await ftpClient.ensureDir(remotePath);

      // Process each file
      for (const file of req.files) {
        const uniqueFileName = generateUniqueFilename(file.originalname);
        const tempFilePath = path.join(__dirname, '../../temp', uniqueFileName);
        
        // Create temp file
        fs.writeFileSync(tempFilePath, file.buffer);
        tempFiles.push(tempFilePath);

        // Upload file
        const remoteFilePath = `${remotePath}/${uniqueFileName}`;
        await ftpClient.uploadFile(tempFilePath, remoteFilePath);

        const publicUrl = `${process.env.BASE_PUBLIC_URL}/${clientCode}/${storeId}/${folderType}/${uniqueFileName}`;
        
        uploadedFiles.push({
          fileName: uniqueFileName,
          path: `/${clientCode}/${storeId}/${folderType}/${uniqueFileName}`,
          url: publicUrl,
          fileId: uniqueFileName.split('_')[1]
        });
      }

      // Close FTP connection
      await ftpClient.close();

      // Clean up temp files
      tempFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      res.json({
        success: true,
        files: uploadedFiles,
        count: uploadedFiles.length
      });

    } catch (error) {
      // Clean up on error
      tempFiles.forEach(filePath => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      await ftpClient.close();

      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete file
  async deleteFile(req, res) {
    const ftpClient = new FTPClient();

    try {
      const { folderType, userId, projectId, fileName } = req.params;

      // Connect to FTP
      await ftpClient.connect();

      // Delete file
      const remoteFilePath = `${process.env.BASE_PUBLIC_PATH}/${folderType}/${userId}/${projectId}/${fileName}`;
      await ftpClient.deleteFile(remoteFilePath);

      // Close FTP connection
      await ftpClient.close();

      res.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      await ftpClient.close();
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get file URL
  async getFileUrl(req, res) {
    try {
      const { folderType, userId, projectId, fileName } = req.params;
      const publicUrl = `${process.env.BASE_PUBLIC_URL}/${folderType}/${userId}/${projectId}/${fileName}`;

      res.json({
        success: true,
        url: publicUrl,
        path: `/${folderType}/${userId}/${projectId}/${fileName}`
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new UploadController();