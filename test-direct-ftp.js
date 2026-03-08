const FTPClient = require('./src/config/ftpClient');
const fs = require('fs');
const path = require('path');

async function testDirectFTPConnection() {
  console.log('🔍 Testing Direct FTP Connection\n');
  
  // Set environment variables explicitly (same as enhancedUploadService)
  process.env.FTP_HOST = 'ftp.enamorimpex.com';
  process.env.FTP_USER = 'eloraftp@storage.enamorimpex.com';
  process.env.FTP_PASSWORD = 'AkshayNeriya!@#2026';
  process.env.FTP_SECURE = 'true';
  
  console.log(`Host: ${process.env.FTP_HOST}`);
  console.log(`User: ${process.env.FTP_USER}`);
  console.log(`Secure: ${process.env.FTP_SECURE}`);
  console.log(`Password: ${process.env.FTP_PASSWORD ? '[SET]' : '[NOT SET]'}\n`);
  
  const ftpClient = new FTPClient();
  let tempFilePath = null;
  
  try {
    // 1. Test connection
    console.log('1️⃣ Connecting to FTP server...');
    await ftpClient.connect();
    console.log('✅ FTP connection successful!\n');
    
    // 2. Create a test file
    console.log('2️⃣ Creating test file...');
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    tempFilePath = path.join(tempDir, 'ftp_test.txt');
    fs.writeFileSync(tempFilePath, 'FTP Connection Test - ' + new Date().toISOString());
    console.log(`✅ Test file created: ${tempFilePath}\n`);
    
    // 3. Test directory creation
    const testPath = `/TEST_FTP_${Date.now()}`;
    console.log(`3️⃣ Creating test directory: ${testPath}`);
    await ftpClient.ensureDir(testPath);
    console.log('✅ Directory created successfully!\n');
    
    // 4. Test file upload
    const remoteFilePath = `${testPath}/test_file.txt`;
    console.log(`4️⃣ Uploading file to: ${remoteFilePath}`);
    await ftpClient.uploadFile(tempFilePath, remoteFilePath);
    console.log('✅ File uploaded successfully!\n');
    
    // 5. Test URL accessibility
    const testUrl = `https://storage.enamorimpex.com/eloraftp${remoteFilePath}`;
    console.log(`5️⃣ Testing URL: ${testUrl}`);
    
    const axios = require('axios');
    try {
      const response = await axios.head(testUrl);
      console.log(`✅ URL accessible: ${response.status}\n`);
    } catch (urlError) {
      console.log(`❌ URL not accessible: ${urlError.response?.status || urlError.message}\n`);
    }
    
    // 6. Cleanup
    console.log('6️⃣ Cleaning up...');
    try {
      await ftpClient.deleteFile(remoteFilePath);
      console.log('✅ Remote file deleted');
    } catch (deleteError) {
      console.log('⚠️ Could not delete remote file:', deleteError.message);
    }
    
    await ftpClient.close();
    console.log('✅ FTP connection closed');
    
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log('✅ Local temp file deleted');
    }
    
    console.log('\n🎉 FTP Connection Test PASSED!');
    
  } catch (error) {
    console.error('❌ FTP Connection Test FAILED:', error.message);
    console.error('Stack:', error.stack);
    
    // Cleanup on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    await ftpClient.close();
  }
}

// Run the test
testDirectFTPConnection();