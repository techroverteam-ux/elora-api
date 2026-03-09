import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

class ImagePathResolver {
  private storageType: string;

  constructor() {
    this.storageType = process.env.STORAGE_TYPE || 'local';
  }

  // Resolve image path for PPT generation
  async resolveImagePath(imagePath: string): Promise<string> {
    if (!imagePath) throw new Error('Image path is empty');
    
    // If it's already a full URL, download it
    if (imagePath.startsWith('http')) {
      return await this.downloadImageTemporarily(imagePath);
    }
    
    // If it's a relative path, convert to full URL first
    if (this.storageType === 'ftps') {
      const fullUrl = `https://storage.enamorimpex.com/eloraftp/${imagePath}`;
      return await this.downloadImageTemporarily(fullUrl);
    }
    
    // Local storage - return local path
    return path.join(process.cwd(), imagePath);
  }

  private async downloadImageTemporarily(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const fileName = `temp_${Date.now()}_${path.basename(url)}`;
      const tempPath = path.join(tempDir, fileName);
      const file = fs.createWriteStream(tempPath);

      const client = url.startsWith('https://') ? https : http;
      
      client.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(tempPath);
        });
      }).on('error', (err) => {
        fs.unlink(tempPath, () => {}); // Delete temp file on error
        reject(err);
      });
    });
  }

  // Clean up temporary files
  cleanupTempFile(filePath: string): void {
    if (filePath.includes('/temp/') && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Get display URL for UI
  getDisplayUrl(imagePath: string): string {
    if (this.storageType === 'ftps' && imagePath.startsWith('https://')) {
      return imagePath; // Already a public URL
    } else if (this.storageType === 'local') {
      return `${process.env.BASE_LOCAL_URL || 'http://localhost:3000'}/${imagePath}`;
    }
    return imagePath;
  }
}

export default new ImagePathResolver();