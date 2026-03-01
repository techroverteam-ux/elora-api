const { Client } = require('basic-ftp');

class FTPClient {
  constructor() {
    this.client = new Client();
    this.client.ftp.verbose = false;
  }

  async connect() {
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: process.env.FTP_SECURE === 'true',
        secureOptions: {
          rejectUnauthorized: false // Allow self-signed certificates
        }
      });
      return true;
    } catch (error) {
      throw new Error(`FTP connection failed: ${error.message}`);
    }
  }

  async ensureDir(path) {
    try {
      await this.client.ensureDir(path);
    } catch (error) {
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  async uploadFile(localPath, remotePath) {
    try {
      await this.client.uploadFrom(localPath, remotePath);
    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  async deleteFile(remotePath) {
    try {
      await this.client.remove(remotePath);
    } catch (error) {
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  async close() {
    this.client.close();
  }
}

module.exports = FTPClient;