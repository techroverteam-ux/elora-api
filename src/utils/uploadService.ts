import fs from 'fs';
import path from 'path';
import googleDriveService from './googleDrive';

type StorageType = 'local' | 'drive';

class UploadService {
  private storageType: StorageType;

  constructor() {
    this.storageType = (process.env.STORAGE_TYPE as StorageType) || 'local';
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    storeId: string,
    folderType: 'Recce' | 'Installation',
    userName: string
  ): Promise<string> {
    if (this.storageType === 'drive') {
      return await googleDriveService.uploadFile(
        fileBuffer,
        fileName,
        mimeType,
        storeId,
        folderType,
        userName
      );
    } else {
      return this.uploadToLocal(fileBuffer, fileName, storeId, folderType, userName);
    }
  }

  private uploadToLocal(
    fileBuffer: Buffer,
    fileName: string,
    storeId: string,
    folderType: 'Recce' | 'Installation',
    userName: string
  ): string {
    const date = new Date().toISOString().split('T')[0];
    const sanitizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
    const extension = path.extname(fileName);
    const baseName = path.basename(fileName, extension);
    const finalFileName = `${baseName}_${sanitizedUserName}_${date}${extension}`;

    const uploadDir = path.join(process.cwd(), 'uploads', storeId, folderType);
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, finalFileName);
    fs.writeFileSync(filePath, fileBuffer);

    return `uploads/${storeId}/${folderType}/${finalFileName}`;
  }

  getStorageType(): StorageType {
    return this.storageType;
  }
}

export default new UploadService();
