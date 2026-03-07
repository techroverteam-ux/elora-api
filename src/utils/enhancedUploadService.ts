const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FTPClient = require('../config/ftpClient');
import { checkConfiguration, validateFTPSConfig } from './configChecker';

type StorageType = 'local' | 'ftps';

class EnhancedUploadService {
  private storageType: StorageType;

  constructor() {
    // Check configuration on startup
    const config = checkConfiguration();
    
    console.log('[INIT] Checking storage configuration...');
    console.log('[INIT] STORAGE_TYPE env:', process.env.STORAGE_TYPE);
    console.log('[INIT] FTP_HOST env:', process.env.FTP_HOST);
    console.log('[INIT] FTP_USER env:', process.env.FTP_USER);
    console.log('[INIT] FTP_SECURE env:', process.env.FTP_SECURE);
    
    // Determine storage type based on environment and configuration
    if (process.env.STORAGE_TYPE === 'ftps' && validateFTPSConfig()) {
      this.storageType = 'ftps';
      console.log('[INIT] ✅ FTPS configuration validated, using FTPS storage');
    } else {
      this.storageType = 'local';
      if (process.env.STORAGE_TYPE === 'ftps') {
        console.warn('[INIT] ⚠️ FTPS requested but configuration invalid, falling back to local storage');
      } else {
        console.log('[INIT] 📁 Using local storage');
      }
    }
  }

  // Generate unique filename with hash
  generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
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
    
    console.log(`[UPLOAD] Storage type: ${this.storageType}`);
    console.log(`[UPLOAD] File details:`, { fileName, clientCode, storeId, folderType });

    if (this.storageType === 'ftps') {
      try {
        console.log('[UPLOAD] Attempting FTPS upload...');
        const result = await this.uploadToFTPS(fileBuffer, uniqueFileName, clientCode, storeId, folderType, userName);
        console.log('[UPLOAD] FTPS upload SUCCESS:', result);
        return result;
      } catch (error: any) {
        console.error('[UPLOAD] FTPS upload FAILED:', error.message);
        console.error('[UPLOAD] Falling back to local storage');
        // Fallback to local storage if FTPS fails
        return this.uploadToLocal(fileBuffer, uniqueFileName, clientCode, storeId, folderType, userName);
      }
    } else {
      console.log('[UPLOAD] Using local storage');
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
      // Create temp file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, fileName);
      fs.writeFileSync(tempFilePath, fileBuffer);

      // Connect to FTP
      await ftpClient.connect();

      // Map folderType to proper names with user
      const folderTypeMap: { [key: string]: string } = {
        'initial': 'Initial Photos',
        'recce': 'ReccePhotos', 
        'installation': 'Installation Photos'
      };
      const mappedFolderType = folderTypeMap[folderType] || folderType;
      
      // Create directory structure: /{clientCode}/{storeId}/{folderType}_{userName}/
      const remotePath = `/${clientCode}/${storeId}/${mappedFolderType}_${userName}`;
      await ftpClient.ensureDir(remotePath);

      // Upload file
      const remoteFilePath = `${remotePath}/${fileName}`;
      await ftpClient.uploadFile(tempFilePath, remoteFilePath);

      // Close FTP connection
      await ftpClient.close();

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      // Return relative path for URL construction
      const relativePath = `${clientCode}/${storeId}/${mappedFolderType}_${userName}/${fileName}`;
      return relativePath;

    } catch (error) {
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
      // Map folderType to match cPanel structure
      const ftpFolderType = folderType === 'installation' ? 'installation-images' : 'recce-images';
      
      // In serverless environments, use /tmp directory which is writable
      const baseDir = process.env.NODE_ENV === 'production' ? '/tmp' : process.cwd();
      const uploadDir = path.join(baseDir, 'uploads', ftpFolderType, `${clientCode}${storeId}`);
      
      console.log(`Creating directory: ${uploadDir}`);
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);
      console.log(`Writing file to: ${filePath}`);
      
      fs.writeFileSync(filePath, fileBuffer);

      // Return the relative path for URL construction
      const relativePath = `uploads/${ftpFolderType}/${clientCode}${storeId}/${fileName}`;
      console.log(`File uploaded successfully, relative path: ${relativePath}`);
      
      return relativePath;
    } catch (error: any) {
      console.error('Local upload failed:', error);
      throw new Error(`Failed to upload file locally: ${error.message}`);
    }
  }

  async deleteFile(
    folderType: string,
    clientCode: string,
    storeId: string,
    fileName: string
  ): Promise<void> {
    const ftpFolderType = folderType === 'installation' ? 'installation-images' : 'recce-images';
    
    if (this.storageType === 'ftps') {
      const ftpClient = new FTPClient();
      try {
        await ftpClient.connect();
        const remoteFilePath = `/eloraftp/uploads/${ftpFolderType}/${clientCode}${storeId}/${fileName}`;
        await ftpClient.deleteFile(remoteFilePath);
        await ftpClient.close();
      } catch (error) {
        await ftpClient.close();
        throw error;
      }
    } else {
      const baseDir = process.env.NODE_ENV === 'production' ? '/tmp' : process.cwd();
      const filePath = path.join(baseDir, 'uploads', ftpFolderType, `${clientCode}${storeId}`, fileName);
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
      const relativePath = `uploads/${folderType}/${clientCode}/${storeId}/${fileName}`;
      return relativePath;
    }
  }

  getStorageType(): StorageType {
    return this.storageType;
  }
}

export default new EnhancedUploadService();