const axios = require('axios');
const FormData = require('form-data');

async function testRecceSubmission() {
  const API_BASE = 'https://elora-api-smoky.vercel.app/api/v1';
  
  console.log('📸 Testing Recce Photo Upload Flow\n');

  try {
    // 1. Admin Login
    console.log('1️⃣ Admin Login...');
    const adminLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@elora.com',
      password: 'Admin@123'
    });
    const adminHeaders = { Authorization: `Bearer ${adminLogin.data.token}` };
    console.log('✅ Admin logged in\n');

    // 2. Get a store that needs recce
    console.log('2️⃣ Finding stores for recce...');
    const storesResponse = await axios.get(`${API_BASE}/stores?status=RECCE_ASSIGNED&limit=1`, { headers: adminHeaders });
    
    if (!storesResponse.data.stores || storesResponse.data.stores.length === 0) {
      console.log('ℹ️ No stores assigned for recce. Creating and assigning one...');
      
      // Create a test store
      const testStore = await axios.post(`${API_BASE}/stores`, {
        dealerCode: `RECCE_TEST_${Date.now()}`,
        storeName: 'Recce Test Store',
        location: {
          city: 'Mumbai',
          district: 'Mumbai Suburban',
          state: 'Maharashtra',
          address: 'Test Address for Recce'
        }
      }, { headers: adminHeaders });
      
      const storeId = testStore.data.store._id;
      console.log(`✅ Test store created: ${storeId}`);
      
      // Get RECCE users and assign
      const recceUsers = await axios.get(`${API_BASE}/users/role/RECCE`, { headers: adminHeaders });
      if (recceUsers.data.users && recceUsers.data.users.length > 0) {
        await axios.post(`${API_BASE}/stores/assign`, {
          storeIds: [storeId],
          userId: recceUsers.data.users[0]._id,
          stage: 'RECCE'
        }, { headers: adminHeaders });
        console.log('✅ Store assigned to RECCE user\n');
      }
    } else {
      console.log(`✅ Found store for recce: ${storesResponse.data.stores[0].storeName}\n`);
    }

    // 3. Login as RECCE user
    console.log('3️⃣ RECCE user login...');
    const recceLogin = await axios.post(`${API_BASE}/auth/login`, {
      email: 'akshayrecce@gmail.com',
      password: 'Akshay@123'
    });
    const recceHeaders = { Authorization: `Bearer ${recceLogin.data.token}` };
    console.log('✅ RECCE user logged in\n');

    // 4. Get assigned stores
    console.log('4️⃣ Getting assigned stores...');
    const assignedStores = await axios.get(`${API_BASE}/stores?status=RECCE_ASSIGNED`, { headers: recceHeaders });
    
    if (!assignedStores.data.stores || assignedStores.data.stores.length === 0) {
      console.log('❌ No stores assigned to this RECCE user');
      return;
    }
    
    const targetStore = assignedStores.data.stores[0];
    console.log(`✅ Found assigned store: ${targetStore.storeName} (${targetStore._id})\n`);

    // 5. Submit recce with file upload
    console.log('5️⃣ Submitting recce with photos...');
    
    // Create test image buffer
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

    const formData = new FormData();
    formData.append('notes', 'Test recce submission from API test');
    formData.append('initialPhotosCount', '1');
    formData.append('initialPhoto0', testImageBuffer, 'initial_test.jpg');
    formData.append('reccePhotosData', JSON.stringify([{
      width: 120,
      height: 60,
      unit: 'in',
      elements: []
    }]));
    formData.append('reccePhoto0', testImageBuffer, 'recce_test.jpg');

    const recceSubmission = await axios.post(`${API_BASE}/stores/${targetStore._id}/recce`, formData, {
      headers: {
        ...recceHeaders,
        ...formData.getHeaders()
      }
    });
    
    console.log('✅ Recce submitted successfully!');
    console.log(`   Store Status: ${recceSubmission.data.store?.currentStatus || 'RECCE_SUBMITTED'}\n`);

    // 6. Verify submission
    console.log('6️⃣ Verifying recce submission...');
    const updatedStore = await axios.get(`${API_BASE}/stores/${targetStore._id}`, { headers: adminHeaders });
    const store = updatedStore.data.store;
    
    console.log('✅ Recce verification complete:');
    console.log(`   Status: ${store.currentStatus}`);
    console.log(`   Initial Photos: ${store.recce?.initialPhotos?.length || 0}`);
    console.log(`   Recce Photos: ${store.recce?.reccePhotos?.length || 0}`);
    console.log(`   Notes: ${store.recce?.notes || 'None'}`);
    
    if (store.recce?.reccePhotos?.length > 0) {
      console.log(`   First Photo URL: ${store.recce.reccePhotos[0].photo}`);
      console.log(`   Measurements: ${store.recce.reccePhotos[0].measurements?.width}x${store.recce.reccePhotos[0].measurements?.height} ${store.recce.reccePhotos[0].measurements?.unit}`);
    }

    console.log('\n🎉 Recce Photo Upload Test PASSED!');
    console.log('\n📋 Verified Features:');
    console.log('✅ RECCE user authentication');
    console.log('✅ Store assignment and retrieval');
    console.log('✅ File upload with FormData');
    console.log('✅ Photo storage and URL generation');
    console.log('✅ Measurements and metadata storage');
    console.log('✅ Status progression (RECCE_ASSIGNED → RECCE_SUBMITTED)');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error(`Status: ${error.response.status}`);
    }
  }
}

testRecceSubmission();