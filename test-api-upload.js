// Test the enhanced upload service directly
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const FTPClient = require('./src/config/ftpClient');

// Inline the enhanced upload service logic for testing
class TestUploadService {
  constructor() {
    // Set production FTPS credentials
    if (!process.env.FTP_HOST) {
      process.env.FTP_HOST = 'ftp.enamorimpex.com';
      process.env.FTP_USER = 'eloraftp@storage.enamorimpex.com';
      process.env.FTP_PASSWORD = 'AkshayNeriya!@#2026';
      process.env.FTP_SECURE = 'true';
      console.log('[INIT] Set production FTPS credentials');
    }
    
    this.storageType = 'ftps';
    console.log('[INIT] Using FTPS storage');
  }

  generateUniqueFilename(originalName) {
    const timestamp = Date.now();
    const randomHash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName) || '.jpg';
    let baseName = path.basename(originalName, ext);
    
    if (!baseName || baseName === '') {
      baseName = 'image';
    }
    
    return `${timestamp}_${randomHash}_${baseName}${ext}`;
  }

  async uploadFile(fileBuffer, fileName, mimeType, clientCode, storeId, folderType, userName) {
    const uniqueFileName = this.generateUniqueFilename(fileName);
    
    console.log(`[UPLOAD] Starting upload: ${clientCode}/${storeId}/${folderType}_${userName}/${uniqueFileName}`);
    
    return await this.uploadToFTPS(fileBuffer, uniqueFileName, clientCode, storeId, folderType, userName);
  }

  async uploadToFTPS(fileBuffer, fileName, clientCode, storeId, folderType, userName) {
    const ftpClient = new FTPClient();
    let tempFilePath = null;

    try {
      console.log(`[FTPS] Upload: ${clientCode}/${storeId}/${folderType}_${userName}`);
      
      // Create temp file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, fileName);
      fs.writeFileSync(tempFilePath, fileBuffer);
      console.log(`[FTPS] Created temp file: ${tempFilePath} (${fileBuffer.length} bytes)`);

      // Connect to FTP
      await ftpClient.connect();
      console.log(`[FTPS] Connected to ${process.env.FTP_HOST}`);

      // Map folder types
      const folderTypeMap = {
        'initial': 'Initial Photos',
        'recce': 'ReccePhotos', 
        'installation': 'Installation Photos'
      };
      const mappedFolderType = folderTypeMap[folderType] || folderType;
      console.log(`[FTPS] Mapped folderType '${folderType}' to '${mappedFolderType}'`);
      
      // Create directory structure: /{clientCode}/{storeId}/{folderType}_{userName}/
      const remotePath = `/${clientCode}/${storeId}/${mappedFolderType}_${userName}`;
      console.log(`[FTPS] Creating remote directory: ${remotePath}`);
      
      await ftpClient.ensureDir(remotePath);
      console.log(`[FTPS] Directory created successfully`);

      // Upload file
      const remoteFilePath = `${remotePath}/${fileName}`;
      console.log(`[FTPS] Uploading file to: ${remoteFilePath}`);
      
      await ftpClient.uploadFile(tempFilePath, remoteFilePath);
      console.log(`[FTPS] File uploaded successfully`);

      // Close FTP connection
      await ftpClient.close();

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      // Return relative path
      const relativePath = `${clientCode}/${storeId}/${mappedFolderType}_${userName}/${fileName}`;
      console.log(`[FTPS] Returning relative path: ${relativePath}`);
      
      return relativePath;

    } catch (error) {
      console.error(`[FTPS] Error during upload:`, error?.message || error);
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      await ftpClient.close();
      throw error;
    }
  }

  getStorageType() {
    return this.storageType;
  }
}

const testUploadService = new TestUploadService();

async function testAPIUploadFlow() {
  console.log('🔍 Testing API Upload Flow (Enhanced Upload Service)\n');
  
  try {
    // Create test image buffer (same as in API)
    const testImageBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x03, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
      0x37, 0xFF, 0xD9
    ]);
    
    console.log(`📊 Storage Type: ${testUploadService.getStorageType()}`);
    console.log(`📦 Buffer Size: ${testImageBuffer.length} bytes\n`);
    
    // Test parameters - USE EXACT SAME FROM LATEST API RESPONSE
    const clientCode = 'FINBAN157811';  // From latest API response
    const storeId = 'BANBANFINAL_1772943158359';  // From latest API response
    const userName = 'Akshay';  // From API response
    const fileName = 'api_test.jpg';
    const mimeType = 'image/jpeg';
    
    console.log('📋 Upload Parameters:');
    console.log(`   Client Code: ${clientCode}`);
    console.log(`   Store ID: ${storeId}`);
    console.log(`   User Name: ${userName}`);
    console.log(`   File Name: ${fileName}\n`);
    
    // Test initial photo upload
    console.log('1️⃣ Testing Initial Photo Upload...');
    const initialResult = await testUploadService.uploadFile(
      testImageBuffer,
      fileName,
      mimeType,
      clientCode,
      storeId,
      'initial',
      userName
    );
    console.log(`✅ Initial Upload Result: ${initialResult}\n`);
    
    // Test recce photo upload
    console.log('2️⃣ Testing Recce Photo Upload...');
    const recceResult = await testUploadService.uploadFile(
      testImageBuffer,
      fileName,
      mimeType,
      clientCode,
      storeId,
      'recce',
      userName
    );
    console.log(`✅ Recce Upload Result: ${recceResult}\n`);
    
    // Test URL accessibility
    console.log('3️⃣ Testing URL Accessibility...');
    const initialUrl = `https://storage.enamorimpex.com/eloraftp/${initialResult}`;
    const recceUrl = `https://storage.enamorimpex.com/eloraftp/${recceResult}`;
    
    console.log(`Initial URL: ${initialUrl}`);
    console.log(`Recce URL: ${recceUrl}\n`);
    
    const axios = require('axios');
    
    try {
      const initialResponse = await axios.head(initialUrl);
      console.log(`✅ Initial URL accessible: ${initialResponse.status}`);
    } catch (error) {
      console.log(`❌ Initial URL not accessible: ${error.response?.status || error.message}`);
    }
    
    try {
      const recceResponse = await axios.head(recceUrl);
      console.log(`✅ Recce URL accessible: ${recceResponse.status}`);
    } catch (error) {
      console.log(`❌ Recce URL not accessible: ${error.response?.status || error.message}`);
    }
    
    console.log('\n🎉 API Upload Flow Test COMPLETED!');
    
  } catch (error) {
    console.error('❌ API Upload Flow Test FAILED:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testAPIUploadFlow();