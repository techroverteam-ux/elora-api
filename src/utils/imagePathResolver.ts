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
    
    // If it's a relative path, construct full URL
    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
    // Decode the path first (in case it has %20 or other encoded chars), then encode properly for URL
    const decodedPath = decodeURIComponent(cleanPath);
    const fullUrl = `https://storage.enamorimpex.com/eloraftp/${encodeURI(decodedPath)}`;
    console.log(`[ImageResolver] Resolving: ${imagePath} -> ${fullUrl}`);
    return await this.downloadImageTemporarily(fullUrl);
  }

  private async downloadImageTemporarily(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Decode URL to get clean filename without %20 or other encoded chars
      const decodedUrl = decodeURIComponent(url);
      const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}_${path.basename(decodedUrl).split('?')[0]}`;
      const tempPath = path.join(tempDir, fileName);
      const file = fs.createWriteStream(tempPath);

      const client = url.startsWith('https://') ? https : http;
      
      const request = client.get(url, { timeout: 10000 }, (response) => {
        if (response.statusCode !== 200) {
          fs.unlink(tempPath, () => {});
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`[ImageResolver] Downloaded to: ${tempPath}`);
          resolve(tempPath);
        });
      }).on('error', (err) => {
        fs.unlink(tempPath, () => {});
        console.error(`[ImageResolver] Download error: ${err.message}`);
        reject(err);
      });
      
      request.setTimeout(10000, () => {
        request.destroy();
        fs.unlink(tempPath, () => {});
        reject(new Error('Download timeout'));
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