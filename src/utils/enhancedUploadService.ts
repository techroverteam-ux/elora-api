const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FTPClient = require('../config/ftpClient');

type StorageType = 'local' | 'ftps';

class EnhancedUploadService {
  private storageType: StorageType;

  constructor() {
    this.storageType = (process.env.STORAGE_TYPE as StorageType) || 'local';
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

    if (this.storageType === 'ftps') {
      return await this.uploadToFTPS(fileBuffer, uniqueFileName, clientCode, storeId, folderType);
    } else {
      return this.uploadToLocal(fileBuffer, uniqueFileName, clientCode, storeId, folderType, userName);
    }
  }

  private async uploadToFTPS(
    fileBuffer: Buffer,
    fileName: string,
    clientCode: string,
    storeId: string,
    folderType: string
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

      // Create directory structure: /uploads/folderType/clientCode/storeId/
      const remotePath = `${process.env.BASE_PUBLIC_PATH}/${folderType}/${clientCode}/${storeId}`;
      await ftpClient.ensureDir(remotePath);

      // Upload file
      const remoteFilePath = `${remotePath}/${fileName}`;
      await ftpClient.uploadFile(tempFilePath, remoteFilePath);

      // Close FTP connection
      await ftpClient.close();

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      return `${process.env.BASE_PUBLIC_URL}/${folderType}/${clientCode}/${storeId}/${fileName}`;

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
    const uploadDir = path.join(process.cwd(), 'uploads', folderType, clientCode, storeId);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, fileBuffer);

    return `uploads/${folderType}/${clientCode}/${storeId}/${fileName}`;
  }

  async deleteFile(
    folderType: string,
    clientCode: string,
    storeId: string,
    fileName: string
  ): Promise<void> {
    if (this.storageType === 'ftps') {
      const ftpClient = new FTPClient();
      try {
        await ftpClient.connect();
        const remoteFilePath = `${process.env.BASE_PUBLIC_PATH}/${folderType}/${clientCode}/${storeId}/${fileName}`;
        await ftpClient.deleteFile(remoteFilePath);
        await ftpClient.close();
      } catch (error) {
        await ftpClient.close();
        throw error;
      }
    } else {
      const filePath = path.join(process.cwd(), 'uploads', folderType, clientCode, storeId, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  getFileUrl(
    folderType: string,
    clientCode: string,
    storeId: string,
    fileName: string
  ): string {
    if (this.storageType === 'ftps') {
      return `${process.env.BASE_PUBLIC_URL}/${folderType}/${clientCode}/${storeId}/${fileName}`;
    } else {
      return `${process.env.BASE_LOCAL_URL || 'http://localhost:3000'}/uploads/${folderType}/${clientCode}/${storeId}/${fileName}`;
    }
  }

  getStorageType(): StorageType {
    return this.storageType;
  }
}

export default new EnhancedUploadService();