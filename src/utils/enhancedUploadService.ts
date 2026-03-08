const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FTPClient = require('../config/ftpClient');
import { checkConfiguration, validateFTPSConfig } from './configChecker';

type StorageType = 'local' | 'ftps';

class EnhancedUploadService {
  private storageType: StorageType;

  constructor() {
    // FORCE production FTPS credentials - NO FALLBACK
    process.env.FTP_HOST = 'ftp.enamorimpex.com';
    process.env.FTP_USER = 'eloraftp@storage.enamorimpex.com';
    process.env.FTP_PASSWORD = 'AkshayNeriya!@#2026';
    process.env.FTP_SECURE = 'true';
    
    console.log('[INIT] FORCED production FTPS credentials');
    console.log(`[INIT] FTPS Config - Host: ${process.env.FTP_HOST}, User: ${process.env.FTP_USER}, Secure: ${process.env.FTP_SECURE}`);
    
    // FORCE FTPS ONLY - NO LOCAL FALLBACK
    this.storageType = 'ftps';
    console.log('[INIT] FORCED FTPS storage - NO FALLBACK ALLOWED');
  }

  // Generate unique filename with hash - match test-business-flow.js pattern
  generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName) || '.jpg'; // Default to .jpg if no extension
    let baseName = path.basename(originalName, ext);
    
    // Clean up already processed filenames to avoid duplication
    baseName = baseName.replace(/^\d+_[a-f0-9]+_/, '');
    
    // If no base name, use a default
    if (!baseName || baseName === '') {
      baseName = 'image';
    }
    
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
    
    console.log(`[UPLOAD] FORCED FTPS upload: ${clientCode}/${storeId}/${folderType}_${userName}/${uniqueFileName}`);

    // FORCE FTPS UPLOAD - NO FALLBACK ALLOWED
    try {
      console.log('[UPLOAD] FORCING FTPS upload - NO LOCAL FALLBACK');
      const result = await this.uploadToFTPS(fileBuffer, uniqueFileName, clientCode, storeId, folderType, userName);
      console.log('[UPLOAD] FTPS upload SUCCESS:', result);
      return result;
    } catch (error: any) {
      console.error('[UPLOAD] FTPS upload FAILED:', error.message);
      console.error('[UPLOAD] FTPS error stack:', error.stack);
      // DO NOT FALLBACK - THROW ERROR TO FORCE FIX
      throw new Error(`FTPS upload failed: ${error.message}`);
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
      console.log(`[FTPS] Upload: ${clientCode}/${storeId}/${folderType}_${userName}`);
      console.log(`[FTPS] Input params - clientCode: '${clientCode}', storeId: '${storeId}', folderType: '${folderType}', userName: '${userName}'`);
      
      // Create temp file - USE /tmp for Vercel serverless
      const tempDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log(`[FTPS] Created temp directory: ${tempDir}`);
      }
      
      tempFilePath = path.join(tempDir, fileName);
      fs.writeFileSync(tempFilePath, fileBuffer);
      console.log(`[FTPS] Created temp file: ${tempFilePath} (${fileBuffer.length} bytes)`);

      // Connect to FTP
      await ftpClient.connect();
      console.log(`[FTPS] Connected to ${process.env.FTP_HOST}`);

      // CORRECT PATH: Match test-business-flow.js exactly
      // /{clientCode}/{storeId}/{folderType}_{userName}/
      const folderTypeMap: { [key: string]: string } = {
        'initial': 'Initial Photos',
        'recce': 'ReccePhotos', 
        'installation': 'Installation Photos'
      };
      const mappedFolderType = folderTypeMap[folderType] || folderType;
      console.log(`[FTPS] Mapped folderType '${folderType}' to '${mappedFolderType}'`);
      
      // Create directory structure exactly as tested: /{clientCode}/{storeId}/{folderType}_{userName}/
      const remotePath = `/${clientCode}/${storeId}/${mappedFolderType}_${userName}`;
      console.log(`[FTPS] Creating remote directory: ${remotePath}`);
      
      await ftpClient.ensureDir(remotePath);
      console.log(`[FTPS] Directory created successfully: ${remotePath}`);

      // Upload file
      const remoteFilePath = `${remotePath}/${fileName}`;
      console.log(`[FTPS] Uploading file to: ${remoteFilePath}`);
      
      await ftpClient.uploadFile(tempFilePath, remoteFilePath);
      console.log(`[FTPS] File uploaded successfully: ${fileName}`);

      // Close FTP connection
      await ftpClient.close();
      console.log(`[FTPS] Connection closed`);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      console.log(`[FTPS] Temp file cleaned up`);

      // Return relative path for URL construction (without leading slash)
      const relativePath = `${clientCode}/${storeId}/${mappedFolderType}_${userName}/${fileName}`;
      console.log(`[FTPS] Returning relative path: ${relativePath}`);
      
      // Test the final URL
      const finalUrl = `https://storage.enamorimpex.com/eloraftp/${relativePath}`;
      console.log(`[FTPS] Final URL will be: ${finalUrl}`);
      
      return relativePath;

    } catch (error: any) {
      console.error(`[FTPS] Error during upload:`, error?.message || error);
      console.error(`[FTPS] Error stack:`, error?.stack);
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log(`[FTPS] Cleaned up temp file after error`);
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
      console.log(`[LOCAL] Upload: ${clientCode}/${storeId}/${folderType}_${userName}`);
      console.log(`[LOCAL] Input params - clientCode: '${clientCode}', storeId: '${storeId}', folderType: '${folderType}', userName: '${userName}'`);
      
      // Map folderType to proper names - match FTPS structure
      const folderTypeMap: { [key: string]: string } = {
        'initial': 'Initial Photos',
        'recce': 'ReccePhotos',
        'installation': 'Installation Photos'
      };
      const mappedFolderType = folderTypeMap[folderType] || folderType;
      console.log(`[LOCAL] Mapped folderType '${folderType}' to '${mappedFolderType}'`);
      
      // Use correct folder structure: clientCode/storeId/folderType_userName
      const baseDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'uploads');
      const uploadDir = path.join(baseDir, clientCode, storeId, `${mappedFolderType}_${userName}`);
      
      console.log(`[LOCAL] Creating directory: ${uploadDir}`);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log(`[LOCAL] Directory created successfully`);
      } else {
        console.log(`[LOCAL] Directory already exists`);
      }

      const filePath = path.join(uploadDir, fileName);
      console.log(`[LOCAL] Writing file to: ${filePath}`);
      
      fs.writeFileSync(filePath, fileBuffer);
      console.log(`[LOCAL] File written successfully (${fileBuffer.length} bytes)`);

      // Return the relative path for URL construction
      const relativePath = `${clientCode}/${storeId}/${mappedFolderType}_${userName}/${fileName}`;
      console.log(`[LOCAL] Returning relative path: ${relativePath}`);
      
      return relativePath;
    } catch (error: any) {
      console.error('[LOCAL] Upload failed:', error);
      console.error('[LOCAL] Error stack:', error?.stack);
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
    // Map folderType to proper names
    const folderTypeMap: { [key: string]: string } = {
      'initial': 'Initial Photos',
      'recce': 'ReccePhotos',
      'installation': 'Installation Photos'
    };
    const mappedFolderType = folderTypeMap[folderType] || folderType;
    
    if (this.storageType === 'ftps') {
      const ftpClient = new FTPClient();
      try {
        await ftpClient.connect();
        const remoteFilePath = `/${clientCode}/${storeId}/${mappedFolderType}_${userName}/${fileName}`;
        await ftpClient.deleteFile(remoteFilePath);
        await ftpClient.close();
      } catch (error) {
        await ftpClient.close();
        throw error;
      }
    } else {
      const baseDir = process.env.NODE_ENV === 'production' ? '/tmp' : path.join(process.cwd(), 'uploads');
      const filePath = path.join(baseDir, clientCode, storeId, `${mappedFolderType}_${userName}`, fileName);
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
      // Map folderType to proper names - match test-business-flow.js
      const folderTypeMap: { [key: string]: string } = {
        'initial': 'Initial Photos',
        'recce': 'ReccePhotos',
        'installation': 'Installation Photos'
      };
      const mappedFolderType = folderTypeMap[folderType] || folderType;
      // CORRECT URL: https://storage.enamorimpex.com/eloraftp/{clientCode}/{storeId}/{folderType}_{userName}/{fileName}
      const url = `https://storage.enamorimpex.com/eloraftp/${clientCode}/${storeId}/${encodeURIComponent(mappedFolderType + '_' + userName)}/${fileName}`;
      return url;
    } else {
      const relativePath = `${clientCode}/${storeId}/${folderType}_${userName}/${fileName}`;
      return relativePath;
    }
  }

  // NEW: Convert relative path to full URL
  convertRelativePathToFullUrl(relativePath: string): string {
    if (!relativePath) return '';
    
    // If already a full URL, return as is
    if (relativePath.startsWith('http')) {
      return relativePath;
    }
    
    // Convert relative path to full URL
    const fullUrl = `https://storage.enamorimpex.com/eloraftp/${relativePath}`;
    console.log(`[URL] Converting '${relativePath}' to '${fullUrl}'`);
    return fullUrl;
  }

  // NEW: Extract components from relative path for frontend use
  parseRelativePath(relativePath: string): {
    clientCode: string;
    storeId: string;
    folderType: string;
    userName: string;
    fileName: string;
  } | null {
    if (!relativePath) return null;
    
    // Expected format: CLIENTCODE/STOREID/FOLDERTYPE_USERNAME/FILENAME
    const parts = relativePath.split('/');
    if (parts.length !== 4) return null;
    
    const [clientCode, storeId, folderWithUser, fileName] = parts;
    
    // Split folderType_userName
    const lastUnderscoreIndex = folderWithUser.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) return null;
    
    const folderType = folderWithUser.substring(0, lastUnderscoreIndex);
    const userName = folderWithUser.substring(lastUnderscoreIndex + 1);
    
    return {
      clientCode,
      storeId,
      folderType,
      userName,
      fileName
    };
  }

  getStorageType(): StorageType {
    return this.storageType;
  }
}

export default new EnhancedUploadService();