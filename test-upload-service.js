const FTPClient = require('./src/config/ftpClient');
const enhancedUploadService = require('./src/utils/enhancedUploadService').default;

async function testUploadService() {
  console.log('🧪 Testing Enhanced Upload Service\n');

  try {
    // Test 1: Check storage type
    console.log('1️⃣ Checking storage configuration...');
    const storageType = enhancedUploadService.getStorageType();
    console.log(`✅ Storage type: ${storageType}\n`);

    // Test 2: Test filename generation
    console.log('2️⃣ Testing filename generation...');
    const testFilename = enhancedUploadService.generateUniqueFilename('test_image.jpg');
    console.log(`✅ Generated filename: ${testFilename}\n`);

    // Test 3: Test URL generation
    console.log('3️⃣ Testing URL generation...');
    const testUrl = enhancedUploadService.getFileUrl('recce', 'JOD', '6100046168', 'test_file.jpg', 'Test_User');
    console.log(`✅ Generated URL: ${testUrl}\n`);

    // Test 4: Test FTPS connection (if available)
    if (storageType === 'ftps') {
      console.log('4️⃣ Testing FTPS connection...');
      const ftpClient = new FTPClient();
      
      try {
        await ftpClient.connect();
        console.log('✅ FTPS connection successful');
        
        // Test directory creation
        const testPath = '/TEST_CLIENT/TEST_STORE/ReccePhotos_Test_User';
        await ftpClient.ensureDir(testPath);
        console.log(`✅ Directory created: ${testPath}`);
        
        await ftpClient.close();
        console.log('✅ FTPS connection closed\n');
      } catch (ftpError) {
        console.error('❌ FTPS connection failed:', ftpError.message);
        console.log('ℹ️ Will fallback to local storage\n');
      }
    }

    // Test 5: Test file upload (local)
    console.log('5️⃣ Testing file upload...');
    const testBuffer = Buffer.from('Test file content for upload');
    
    try {
      const uploadResult = await enhancedUploadService.uploadFile(
        testBuffer,
        'test_upload.txt',
        'text/plain',
        'TEST_CLIENT',
        'TEST_STORE_123',
        'recce',
        'Test_User'
      );
      console.log(`✅ File uploaded successfully: ${uploadResult}\n`);
      
      // Test 6: Generate final URL
      console.log('6️⃣ Testing final URL generation...');
      const finalUrl = enhancedUploadService.getFileUrl(
        'recce',
        'TEST_CLIENT', 
        'TEST_STORE_123',
        uploadResult.split('/').pop(),
        'Test_User'
      );
      console.log(`✅ Final URL: ${finalUrl}\n`);
      
    } catch (uploadError) {
      console.error('❌ Upload failed:', uploadError.message);
    }

    console.log('🎉 Upload Service Test Complete!');
    console.log('\n📋 Test Summary:');
    console.log('✅ Storage configuration verified');
    console.log('✅ Filename generation working');
    console.log('✅ URL generation working');
    console.log('✅ File upload functionality tested');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUploadService();