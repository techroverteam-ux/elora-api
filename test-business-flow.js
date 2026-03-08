const FTPClient = require('./src/config/ftpClient');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Production environment variables
process.env.FTP_HOST = 'ftp.enamorimpex.com';
process.env.FTP_USER = 'eloraftp@storage.enamorimpex.com';
process.env.FTP_PASSWORD = 'AkshayNeriya!@#2026';
process.env.FTP_SECURE = 'true';

async function testCorrectBusinessFlow() {
  const ftpClient = new FTPClient();
  
  try {
    await ftpClient.connect();
    console.log('✅ Connected\n');

    // Test data
    const clientCode = 'TESMUM368613';
    const storeId = '6100046168';
    const userName = 'John_Doe'; // Dynamic user name
    const folderTypes = [
      { type: 'Initial Photos', user: 'Survey_Team_Raj' },
      { type: 'ReccePhotos', user: 'Recce_Boy_Amit' },
      { type: 'Installation Photos', user: 'Install_Boy_Vikash' }
    ];

    console.log('📁 Creating correct folder structure:');
    console.log(`storage.enamorimpex.com/{clientCode}/{storeId}/{folderType}/\n`);

    for (const folder of folderTypes) {
      // CORRECT PATH: /{clientCode}/{storeId}/{folderType}_{userName}/
      const correctPath = `/${clientCode}/${storeId}/${folder.type}_${folder.user}`;
      console.log(`📤 Creating: ${correctPath}`);
      
      await ftpClient.ensureDir(correctPath);
      
      // Upload test file
      const testFileName = `test_${Date.now()}.jpg`;
      const testFilePath = path.join(__dirname, testFileName);
      
      // Create test image
      const jpegBuffer = Buffer.from([
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
      fs.writeFileSync(testFilePath, jpegBuffer);
      
      await ftpClient.uploadFile(testFilePath, `${correctPath}/${testFileName}`);
      console.log(`✅ Uploaded to ${folder.type} by ${folder.user}`);
      
      // Test URL
      const testUrl = `https://storage.enamorimpex.com/eloraftp/${clientCode}/${storeId}/${encodeURIComponent(folder.type + '_' + folder.user)}/${testFileName}`;
      console.log(`🌐 URL: ${testUrl}`);
      
      try {
        const response = await axios.head(testUrl, { timeout: 3000 });
        console.log(`✅ URL works: ${response.status}\n`);
      } catch (error) {
        console.log(`❌ URL failed: ${error.response?.status || 'TIMEOUT'}\n`);
      }
      
      fs.unlinkSync(testFilePath);
    }
    
    await ftpClient.close();
    
    console.log('📋 CORRECT CONFIGURATION:');
    console.log('='.repeat(50));
    console.log('BASE_PUBLIC_PATH: /eloraftp');
    console.log('BASE_PUBLIC_URL: https://storage.enamorimpex.com/eloraftp');
    console.log('Folder Structure: /{clientCode}/{storeId}/{folderType}_{userName}/');
    console.log('Folder Types: Initial Photos_Survey_Team, ReccePhotos_Recce_Boy, Installation Photos_Install_Boy');

  } catch (error) {
    console.error('❌ Error:', error.message);
    await ftpClient.close();
  }
}

testCorrectBusinessFlow();