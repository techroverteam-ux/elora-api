const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:5000/api/v1';
let AUTH_TOKEN = '';

// Test store data
const testStore = {
  id: '', // Will be filled after creating a test store
  clientCode: 'TEST',
  storeId: 'TESTSTORE001',
  storeName: 'Test Store for Upload',
  dealerCode: 'STORE001',
  location: {
    city: 'Test City',
    district: 'Test District',
    state: 'Test State',
    zone: 'North'
  }
};

// Create a minimal valid JPEG test image
function createTestImage(filename) {
  const testDir = path.join(__dirname, 'test-images');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  
  const testImagePath = path.join(testDir, filename);
  
  // Create a minimal valid JPEG file (1x1 pixel red)
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
  
  return testImagePath;
}

// Step 1: Login to get auth token
async function login() {
  console.log('\n=== Step 1: Login ===');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'admin@elora.com',
      password: 'admin123'
    });
    
    AUTH_TOKEN = response.data.token;
    console.log('✅ Login successful');
    console.log('Token:', AUTH_TOKEN.substring(0, 20) + '...');
    return true;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    console.log('\n⚠️ Please update the login credentials in the script');
    return false;
  }
}

// Step 2: Create a test store
async function createTestStore() {
  console.log('\n=== Step 2: Create Test Store ===');
  
  try {
    const response = await axios.post(`${API_BASE_URL}/stores`, testStore, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    testStore.id = response.data._id;
    console.log('✅ Store created successfully');
    console.log('Store ID:', testStore.id);
    return true;
  } catch (error) {
    console.error('❌ Store creation failed:', error.response?.data || error.message);
    
    // If store already exists, try to get it
    if (error.response?.status === 400) {
      console.log('Store might already exist, trying to fetch existing stores...');
      return await getExistingStore();
    }
    return false;
  }
}

// Get existing store if creation fails
async function getExistingStore() {
  try {
    const response = await axios.get(`${API_BASE_URL}/stores?limit=1`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    if (response.data.stores && response.data.stores.length > 0) {
      const store = response.data.stores[0];
      testStore.id = store._id;
      testStore.clientCode = store.clientCode || 'TEST';
      testStore.storeId = store.storeId || 'TESTSTORE001';
      console.log('✅ Using existing store');
      console.log('Store ID:', testStore.id);
      console.log('Store Code:', testStore.clientCode + testStore.storeId);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Failed to get existing store:', error.response?.data || error.message);
    return false;
  }
}

// Step 3: Submit Recce with photos
async function submitRecce() {
  console.log('\n=== Step 3: Submit Recce ===');
  
  try {
    const formData = new FormData();
    
    // Create test images
    const initialPhoto1 = createTestImage('initial1.jpg');
    const initialPhoto2 = createTestImage('initial2.jpg');
    const reccePhoto1 = createTestImage('recce1.jpg');
    const reccePhoto2 = createTestImage('recce2.jpg');
    
    // Add initial photos
    formData.append('initialPhotosCount', '2');
    formData.append('initialPhoto0', fs.createReadStream(initialPhoto1));
    formData.append('initialPhoto1', fs.createReadStream(initialPhoto2));
    
    // Add recce photos with measurements
    const reccePhotosData = [
      {
        width: 10,
        height: 8,
        unit: 'ft',
        elements: ['Banner', 'Signage']
      },
      {
        width: 12,
        height: 10,
        unit: 'ft',
        elements: ['Display']
      }
    ];
    
    formData.append('reccePhotosData', JSON.stringify(reccePhotosData));
    formData.append('reccePhoto0', fs.createReadStream(reccePhoto1));
    formData.append('reccePhoto1', fs.createReadStream(reccePhoto2));
    
    // Add notes
    formData.append('notes', 'Test recce submission with multiple photos');
    
    const response = await axios.post(
      `${API_BASE_URL}/stores/${testStore.id}/recce`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    console.log('✅ Recce submitted successfully');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Recce submission failed:', error.response?.data || error.message);
    return false;
  }
}

// Step 4: Submit Installation with photos
async function submitInstallation() {
  console.log('\n=== Step 4: Submit Installation ===');
  
  try {
    const formData = new FormData();
    
    // Create test images
    const installPhoto1 = createTestImage('install1.jpg');
    const installPhoto2 = createTestImage('install2.jpg');
    
    // Add installation photos
    const installationPhotosData = [
      { reccePhotoIndex: 0 },
      { reccePhotoIndex: 1 }
    ];
    
    formData.append('installationPhotosData', JSON.stringify(installationPhotosData));
    formData.append('installationPhoto0', fs.createReadStream(installPhoto1));
    formData.append('installationPhoto1', fs.createReadStream(installPhoto2));
    
    const response = await axios.post(
      `${API_BASE_URL}/stores/${testStore.id}/installation`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    console.log('✅ Installation submitted successfully');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Installation submission failed:', error.response?.data || error.message);
    return false;
  }
}

// Step 5: Verify folder structure
async function verifyFolderStructure() {
  console.log('\n=== Step 5: Verify Folder Structure ===');
  
  const uploadsDir = path.join(__dirname, 'uploads');
  console.log('Checking uploads directory:', uploadsDir);
  
  if (!fs.existsSync(uploadsDir)) {
    console.log('❌ Uploads directory does not exist');
    return false;
  }
  
  console.log('✅ Uploads directory exists');
  
  // Check for different folder structures
  const possiblePaths = [
    path.join(uploadsDir, 'initial', testStore.clientCode, testStore.storeId),
    path.join(uploadsDir, 'recce', testStore.clientCode, testStore.storeId),
    path.join(uploadsDir, 'installation', testStore.clientCode, testStore.storeId),
    path.join(uploadsDir, testStore.storeId, 'Recce'),
    path.join(uploadsDir, testStore.storeId, 'Installation')
  ];
  
  let foundFiles = false;
  
  for (const checkPath of possiblePaths) {
    if (fs.existsSync(checkPath)) {
      const files = fs.readdirSync(checkPath);
      if (files.length > 0) {
        console.log(`✅ Found ${files.length} files in: ${checkPath}`);
        console.log('   Files:', files.slice(0, 5).join(', '));
        foundFiles = true;
      }
    }
  }
  
  if (!foundFiles) {
    console.log('⚠️ No files found in expected locations');
    console.log('Listing all subdirectories in uploads:');
    listDirectory(uploadsDir, 0, 2);
  }
  
  return foundFiles;
}

// Helper function to list directory recursively
function listDirectory(dir, depth, maxDepth) {
  if (depth >= maxDepth) return;
  
  try {
    const items = fs.readdirSync(dir);
    const indent = '  '.repeat(depth);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        console.log(`${indent}📁 ${item}/`);
        listDirectory(fullPath, depth + 1, maxDepth);
      } else {
        console.log(`${indent}📄 ${item}`);
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
}

// Step 6: Get store details to verify uploads
async function getStoreDetails() {
  console.log('\n=== Step 6: Get Store Details ===');
  
  try {
    const response = await axios.get(`${API_BASE_URL}/stores/${testStore.id}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`
      }
    });
    
    const store = response.data;
    console.log('✅ Store details retrieved');
    console.log('\nRecce Status:', store.recce?.status || 'Not submitted');
    console.log('Recce Photos:', store.recce?.photos?.length || 0);
    console.log('Initial Photos:', store.recce?.initialPhotos?.length || 0);
    
    console.log('\nInstallation Status:', store.installation?.status || 'Not submitted');
    console.log('Installation Photos:', store.installation?.photos?.length || 0);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to get store details:', error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Recce & Installation API Tests');
  console.log('API Base URL:', API_BASE_URL);
  console.log('='.repeat(60));
  
  // Step 1: Login
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ Tests aborted: Login failed');
    return;
  }
  
  // Step 2: Create or get test store
  const storeSuccess = await createTestStore();
  if (!storeSuccess) {
    console.log('\n❌ Tests aborted: Store setup failed');
    return;
  }
  
  // Step 3: Submit Recce
  await submitRecce();
  
  // Wait a bit for file system operations
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 4: Submit Installation
  await submitInstallation();
  
  // Wait a bit for file system operations
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Step 5: Verify folder structure
  await verifyFolderStructure();
  
  // Step 6: Get store details
  await getStoreDetails();
  
  console.log('\n' + '='.repeat(60));
  console.log('✨ All tests completed!');
  console.log('\n📝 Summary:');
  console.log('- Test images created in: ./test-images/');
  console.log('- Uploaded files should be in: ./uploads/');
  console.log('- Store ID:', testStore.id);
  console.log('- Store Code:', testStore.clientCode + testStore.storeId);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Unexpected error:', error);
});
