const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FTPClient = require('../config/ftpClient');
import { checkConfiguration, validateFTPSConfig } from './configChecker';
import logger from './logger';

type StorageType = 'local' | 'ftps';

class EnhancedUploadService {
  private storageType: StorageType;

  constructor() {
    // Force FTPS for now - set default values if not provided
    if (!process.env.FTP_HOST) {
      process.env.FTP_HOST = 'ftp.enamorimpex.com';
      process.env.FTP_USER = 'eloraftp@storage.enamorimpex.com';
      process.env.FTP_PASSWORD = 'AkshayNeriya!@#2026';
      process.env.FTP_SECURE = 'true';
    }
    
    // Determine storage type based on environment and configuration
    if (validateFTPSConfig()) {
      this.storageType = 'ftps';
    } else {
      this.storageType = 'local';
    }
  }

  // Generate unique filename with hash
  generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    let baseName = path.basename(originalName, ext);
    
    // Clean up already processed filenames to avoid duplication
    baseName = baseName.replace(/^\d+_[a-f0-9]+_/, '');
    
    return `${timestamp}_${randomHash}_${baseName}${ext}`;
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    clientCode: string,
    storeId: string,
    folderType: 'initial' | 'recce' | 'installation',
    userName: string
  ): Promise<string> {
    const uniqueFileName = this.generateUniqueFilename(fileName);

    if (this.storageType === 'ftps') {
      try {
        const result = await this.uploadToFTPS(fileBuffer, uniqueFileName, clientCode, storeId, folderType, userName);
        return result;
      } catch (error: any) {
        logger.error('[UPLOAD] FTPS failed, using local', { error: error.message, clientCode, storeId });
        return this.uploadToLocal(fileBuffer, uniqueFileName, clientCode, storeId, folderType, userName);
      }
    } else {
      logger.info('[UPLOAD] Using local storage', { clientCode, storeId });
      return this.uploadToLocal(fileBuffer, uniqueFileName, clientCode, storeId, folderType, userName);
    }
  }

  private async uploadToFTPS(
    fileBuffer: Buffer,
    fileName: string,
    clientCode: string,
    storeId: string,
    folderType: string,
    userName: string
  ): Promise<string> {
    const ftpClient = new FTPClient();
    let tempFilePath = null;

    try {
      logger.info('[FTPS] Starting upload', { clientCode, storeId, folderType, userName });
      
      // Create temp file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, fileName);
      fs.writeFileSync(tempFilePath, fileBuffer);
      logger.debug('[FTPS] Temp file created', { tempFilePath });

      // Connect to FTP
      logger.info('[FTPS] Connecting to FTP server');
      await ftpClient.connect();
      logger.info('[FTPS] Connected successfully');

      // Map folderType to proper names with user
      const folderTypeMap: { [key: string]: string } = {
        'initial': 'Initial Photos',
        'recce': 'ReccePhotos', 
        'installation': 'Installation Photos'
      };
      const mappedFolderType = folderTypeMap[folderType] || folderType;
      
      // Create directory structure: /{clientCode}/{storeId}/{folderType}_{userName}/
      const remotePath = `/eloraftp/${clientCode}/${storeId}/${mappedFolderType}_${userName}`;
      logger.info('[FTPS] Creating directory', { remotePath });
      await ftpClient.ensureDir(remotePath);
      logger.info('[FTPS] Directory created successfully');

      // Upload file
      const remoteFilePath = `${remotePath}/${fileName}`;
      logger.info('[FTPS] Uploading file', { remoteFilePath });
      await ftpClient.uploadFile(tempFilePath, remoteFilePath);
      logger.info('[FTPS] File uploaded successfully');

      // Close FTP connection
      await ftpClient.close();
      logger.debug('[FTPS] Connection closed');

      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      logger.debug('[FTPS] Temp file cleaned up');

      // Return relative path for URL construction
      const relativePath = `${clientCode}/${storeId}/${mappedFolderType}_${userName}/${fileName}`;
      logger.info('[FTPS] Upload completed', { relativePath });
      return relativePath;

    } catch (error: any) {
      logger.error('[FTPS] Upload failed', { error: error?.message || error, clientCode, storeId });
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      await ftpClient.close();
      throw error;
    }
  }

  private uploadToLocal(
    fileBuffer: Buffer,
    fileName: string,
    clientCode: string,
    storeId: string,
    folderType: string,
    userName: string
  ): string {
    try {
      // Use correct folder structure: clientCode/storeId/folderType_userName
      const baseDir = process.env.NODE_ENV === 'production' ? '/tmp' : process.cwd();
      const uploadDir = path.join(baseDir, clientCode, storeId, `${folderType}_${userName}`);
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, fileBuffer);

      // Return the relative path for URL construction
      const relativePath = `${clientCode}/${storeId}/${folderType}_${userName}/${fileName}`;
      
      return relativePath;
    } catch (error: any) {
      logger.error('Local upload failed', { error: error.message, clientCode, storeId });
      throw new Error(`Failed to upload file locally: ${error.message}`);
    }
  }

  async deleteFile(
    folderType: string,
    clientCode: string,
    storeId: string,
    fileName: string,
    userName: string
  ): Promise<void> {
    if (this.storageType === 'ftps') {
      const ftpClient = new FTPClient();
      try {
        await ftpClient.connect();
        const remoteFilePath = `/${clientCode}/${storeId}/${folderType}_${userName}/${fileName}`;
        await ftpClient.deleteFile(remoteFilePath);
        await ftpClient.close();
      } catch (error) {
        await ftpClient.close();
        throw error;
      }
    } else {
      const baseDir = process.env.NODE_ENV === 'production' ? '/tmp' : process.cwd();
      const filePath = path.join(baseDir, clientCode, storeId, `${folderType}_${userName}`, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  getFileUrl(
    folderType: string,
    clientCode: string,
    storeId: string,
    fileName: string,
    userName: string
  ): string {
    if (this.storageType === 'ftps') {
      // Map folderType to proper names
      const folderTypeMap: { [key: string]: string } = {
        'initial': 'Initial Photos',
        'recce': 'ReccePhotos',
        'installation': 'Installation Photos'
      };
      const mappedFolderType = folderTypeMap[folderType] || folderType;
      const url = `https://storage.enamorimpex.com/eloraftp/${clientCode}/${storeId}/${encodeURIComponent(mappedFolderType + '_' + userName)}/${fileName}`;
      return url;
    } else {
      const relativePath = `${clientCode}/${storeId}/${folderType}_${userName}/${fileName}`;
      return relativePath;
    }
  }

  getStorageType(): StorageType {
    return this.storageType;
  }
}

export default new EnhancedUploadService();