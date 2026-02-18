import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';

const CREDENTIALS_PATH = path.join(process.cwd(), 'google-drive-credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

class GoogleDriveService {
  private drive: any;
  private rootFolderId: string;

  constructor() {
    this.rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    this.initializeDrive();
  }

  private initializeDrive() {
    try {
      let credentials;

      // Try to get credentials from environment variable first (for Vercel)
      if (process.env.GOOGLE_CREDENTIALS) {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        console.log('✅ Using Google credentials from environment variable');
      } 
      // Fallback to file (for local development)
      else if (fs.existsSync(CREDENTIALS_PATH)) {
        credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
        console.log('✅ Using Google credentials from file');
      } 
      else {
        console.error('❌ Google Drive credentials not found in environment or file');
        return;
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: SCOPES,
      });

      this.drive = google.drive({ version: 'v3', auth });
      console.log('✅ Google Drive initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Google Drive:', error);
    }
  }

  // Find or create folder by name under parent
  private async findOrCreateFolder(folderName: string, parentId: string): Promise<string> {
    try {
      // Search for existing folder
      const response = await this.drive.files.list({
        q: `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      };

      const folder = await this.drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
        supportsAllDrives: true,
      });

      return folder.data.id;
    } catch (error) {
      console.error('Error finding/creating folder:', error);
      throw error;
    }
  }

  // Upload file to Google Drive
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    storeId: string,
    folderType: 'Recce' | 'Installation',
    userName: string
  ): Promise<string> {
    try {
      if (!this.drive) {
        throw new Error('Google Drive not initialized');
      }

      // Create folder structure: Root > StoreID > Recce/Installation
      const storeFolderId = await this.findOrCreateFolder(storeId, this.rootFolderId);
      const typeFolderId = await this.findOrCreateFolder(folderType, storeFolderId);

      // Create filename with username and date
      const date = new Date().toISOString().split('T')[0];
      const sanitizedUserName = userName.replace(/[^a-zA-Z0-9]/g, '_');
      const extension = path.extname(fileName);
      const baseName = path.basename(fileName, extension);
      const finalFileName = `${baseName}_${sanitizedUserName}_${date}${extension}`;

      // Convert buffer to stream
      const bufferStream = new Readable();
      bufferStream.push(fileBuffer);
      bufferStream.push(null);

      const fileMetadata = {
        name: finalFileName,
        parents: [typeFolderId],
      };

      const media = {
        mimeType: mimeType,
        body: bufferStream,
      };

      const file = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
        supportsAllDrives: true,
      });

      // Make file accessible (optional - for viewing without auth)
      await this.drive.permissions.create({
        fileId: file.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
      });

      console.log(`✅ Uploaded: ${finalFileName} to ${folderType}`);
      return file.data.webViewLink || file.data.id;
    } catch (error) {
      console.error('Error uploading file to Google Drive:', error);
      throw error;
    }
  }

  // Upload multiple files (for recce with 3 images)
  async uploadMultipleFiles(
    files: { buffer: Buffer; fileName: string; mimeType: string }[],
    storeId: string,
    folderType: 'Recce' | 'Installation',
    userName: string
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.uploadFile(file.buffer, file.fileName, file.mimeType, storeId, folderType, userName)
    );
    return Promise.all(uploadPromises);
  }

  // Get folder link for a store
  async getStoreFolderLink(storeId: string): Promise<string | null> {
    try {
      const storeFolderId = await this.findOrCreateFolder(storeId, this.rootFolderId);
      const folder = await this.drive.files.get({
        fileId: storeFolderId,
        fields: 'webViewLink',
        supportsAllDrives: true,
      });
      return folder.data.webViewLink;
    } catch (error) {
      console.error('Error getting folder link:', error);
      return null;
    }
  }
}

export default new GoogleDriveService();
