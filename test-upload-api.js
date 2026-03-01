const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:3001/api/v1/files';
const TEST_IMAGE_PATH = path.join(__dirname, 'public', 'logo.png');

// Test data
const testData = {
  clientCode: 'BAR',
  storeId: '6100046168',
  folderType: 'Recce' // or 'Installation'
};

// Create a test image if it doesn't exist
function createTestImage() {
  const testDir = path.join(__dirname, 'test-images');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testImagePath = path.join(testDir, 'test-image.jpg');
  
  // If test image doesn't exist, copy from public folder or create a dummy file
  if (!fs.existsSync(testImagePath)) {
    if (fs.existsSync(TEST_IMAGE_PATH)) {
      fs.copyFileSync(TEST_IMAGE_PATH, testImagePath);
    } else {
      // Create a minimal valid JPEG file (1x1 pixel)
      const buffer = Buffer.from([
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
      fs.writeFileSync(testImagePath, buffer);
    }
  }
  
  return testImagePath;
}

// Test 1: Upload single file for Recce
async function testSingleUploadRecce() {
  console.log('\n=== Test 1: Upload Single File for Recce ===');
  
  try {
    const testImagePath = createTestImage();
    const formData = new FormData();
    
    formData.append('files', fs.createReadStream(testImagePath));
    formData.append('clientCode', testData.clientCode);
    formData.append('storeId', testData.storeId);
    formData.append('folderType', 'Recce');
    
    const response = await axios.post(`${API_BASE_URL}/upload-multiple`, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Test 2: Upload single file for Installation
async function testSingleUploadInstallation() {
  console.log('\n=== Test 2: Upload Single File for Installation ===');
  
  try {
    const testImagePath = createTestImage();
    const formData = new FormData();
    
    formData.append('files', fs.createReadStream(testImagePath));
    formData.append('clientCode', testData.clientCode);
    formData.append('storeId', testData.storeId);
    formData.append('folderType', 'Installation');
    
    const response = await axios.post(`${API_BASE_URL}/upload-multiple`, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Test 3: Upload multiple files for Recce
async function testMultipleUploadRecce() {
  console.log('\n=== Test 3: Upload Multiple Files for Recce ===');
  
  try {
    const testImagePath = createTestImage();
    const formData = new FormData();
    
    // Add multiple files
    formData.append('files', fs.createReadStream(testImagePath));
    formData.append('files', fs.createReadStream(testImagePath));
    formData.append('files', fs.createReadStream(testImagePath));
    
    formData.append('clientCode', testData.clientCode);
    formData.append('storeId', testData.storeId);
    formData.append('folderType', 'Recce');
    
    const response = await axios.post(`${API_BASE_URL}/upload-multiple`, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Test 4: Upload multiple files for Installation
async function testMultipleUploadInstallation() {
  console.log('\n=== Test 4: Upload Multiple Files for Installation ===');
  
  try {
    const testImagePath = createTestImage();
    const formData = new FormData();
    
    // Add multiple files
    formData.append('files', fs.createReadStream(testImagePath));
    formData.append('files', fs.createReadStream(testImagePath));
    
    formData.append('clientCode', testData.clientCode);
    formData.append('storeId', testData.storeId);
    formData.append('folderType', 'Installation');
    
    const response = await axios.post(`${API_BASE_URL}/upload-multiple`, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Test 5: Verify folder structure
async function verifyFolderStructure() {
  console.log('\n=== Test 5: Verify Folder Structure ===');
  
  const uploadsDir = path.join(__dirname, 'uploads');
  const expectedPath = path.join(uploadsDir, `${testData.clientCode}${testData.storeId}`);
  
  console.log('Expected folder path:', expectedPath);
  
  if (fs.existsSync(expectedPath)) {
    console.log('✅ Folder exists');
    
    const reccePath = path.join(expectedPath, 'Recce');
    const installationPath = path.join(expectedPath, 'Installation');
    
    if (fs.existsSync(reccePath)) {
      const recceFiles = fs.readdirSync(reccePath);
      console.log(`✅ Recce folder exists with ${recceFiles.length} files`);
      console.log('   Files:', recceFiles.slice(0, 3).join(', '), recceFiles.length > 3 ? '...' : '');
    } else {
      console.log('❌ Recce folder does not exist');
    }
    
    if (fs.existsSync(installationPath)) {
      const installFiles = fs.readdirSync(installationPath);
      console.log(`✅ Installation folder exists with ${installFiles.length} files`);
      console.log('   Files:', installFiles.slice(0, 3).join(', '), installFiles.length > 3 ? '...' : '');
    } else {
      console.log('❌ Installation folder does not exist');
    }
  } else {
    console.log('❌ Folder does not exist');
  }
}

// Test 6: Test with different client and store
async function testDifferentStore() {
  console.log('\n=== Test 6: Upload to Different Store ===');
  
  try {
    const testImagePath = createTestImage();
    const formData = new FormData();
    
    formData.append('files', fs.createReadStream(testImagePath));
    formData.append('clientCode', 'JOD');
    formData.append('storeId', '6100004530');
    formData.append('folderType', 'Recce');
    
    const response = await axios.post(`${API_BASE_URL}/upload-multiple`, formData, {
      headers: formData.getHeaders()
    });
    
    console.log('✅ Success:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    return null;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting File Upload API Tests');
  console.log('API Base URL:', API_BASE_URL);
  console.log('Test Data:', testData);
  
  await testSingleUploadRecce();
  await testSingleUploadInstallation();
  await testMultipleUploadRecce();
  await testMultipleUploadInstallation();
  await testDifferentStore();
  await verifyFolderStructure();
  
  console.log('\n✨ All tests completed!');
}

// Run tests
runAllTests().catch(console.error);
