const axios = require('axios');
const FormData = require('form-data');

async function testExactAPIFlow() {
  const API_BASE = 'https://elora-api-smoky.vercel.app/api/v1';
  
  console.log('🔍 Testing Exact API Flow with Real Parameters\n');

  try {
    // 1. Login as Admin
    console.log('1️⃣ Admin Login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@elora.com',
      password: 'Admin@123'
    });
    const authToken = loginResponse.data.token;
    const headers = { Authorization: `Bearer ${authToken}` };
    console.log('✅ Admin logged in\n');

    // 2. Get elements
    const elementsResponse = await axios.get(`${API_BASE}/elements/all`, { headers });
    const firstElement = elementsResponse.data.elements[0];
    console.log(`✅ Found element: ${firstElement.name}\n`);

    // 3. Create unique client with exact same pattern
    const timestamp = Date.now();
    const clientData = {
      clientName: `Debug Client ${timestamp}`,
      branchName: 'Debug Branch',
      amount: 100000,
      gstNumber: `07DEBUG${timestamp.toString().slice(-6)}Z6`,
      elements: [{
        elementId: firstElement._id,
        elementName: firstElement.name,
        customRate: 150,
        quantity: 1
      }]
    };

    console.log('3️⃣ Creating debug client...');
    const clientResponse = await axios.post(`${API_BASE}/clients`, clientData, { headers });
    const clientCode = clientResponse.data.client.clientCode;
    console.log(`✅ Client created: ${clientCode}\n`);

    // 4. Create unique store
    console.log('4️⃣ Creating debug store...');
    const storeData = {
      dealerCode: `DEBUG_${timestamp}`,
      storeName: `Debug Store ${timestamp}`,
      clientCode: clientCode,
      location: {
        city: 'Debug City',
        district: 'Debug District', 
        state: 'Debug State',
        address: 'Debug Address'
      }
    };

    const storeResponse = await axios.post(`${API_BASE}/stores`, storeData, { headers });
    const storeId = storeResponse.data.store._id;
    const storeCode = storeResponse.data.store.storeId;
    console.log(`✅ Store created: ${storeId}`);
    console.log(`📍 Store Code: ${storeCode}\n`);

    // 5. Get RECCE user
    const recceUsersResponse = await axios.get(`${API_BASE}/users/role/RECCE`, { headers });
    const recceUser = recceUsersResponse.data.users[0];
    console.log(`✅ RECCE user: ${recceUser.name}\n`);

    // 6. Assign store to RECCE
    await axios.post(`${API_BASE}/stores/assign`, {
      storeIds: [storeId],
      userId: recceUser._id,
      stage: 'RECCE'
    }, { headers });
    console.log('✅ Store assigned to RECCE\n');

    // 7. Login as RECCE user
    const recceLoginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'akshayrecce@gmail.com',
      password: 'Akshay@123'
    });
    const recceHeaders = { Authorization: `Bearer ${recceLoginResponse.data.token}` };
    console.log('✅ RECCE user logged in\n');

    // 8. Create test image
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

    console.log('8️⃣ Preparing recce submission...');
    console.log(`📁 Expected folder structure:`);
    console.log(`   Client Code: ${clientCode}`);
    console.log(`   Store Code: ${storeCode}`);
    console.log(`   User: ${recceUser.name}`);
    console.log(`   Expected Path: /${clientCode}/${storeCode}/Initial Photos_${recceUser.name}/`);
    console.log(`   Expected Path: /${clientCode}/${storeCode}/ReccePhotos_${recceUser.name}/\n`);

    // 9. Submit recce with detailed logging
    const formData = new FormData();
    formData.append('notes', 'Debug API test submission');
    formData.append('initialPhotosCount', '1');
    formData.append('initialPhoto0', testImageBuffer, `debug_initial_${timestamp}.jpg`);
    formData.append('reccePhotosData', JSON.stringify([{
      width: 100,
      height: 50,
      unit: 'in',
      elements: [{
        elementId: firstElement._id,
        elementName: firstElement.name,
        quantity: 1
      }]
    }]));
    formData.append('reccePhoto0', testImageBuffer, `debug_recce_${timestamp}.jpg`);

    console.log('🚀 Submitting recce data via API...');
    console.log('📤 Form data prepared with files');
    
    const recceResponse = await axios.post(`${API_BASE}/stores/${storeId}/recce`, formData, {
      headers: {
        ...recceHeaders,
        ...formData.getHeaders()
      },
      timeout: 60000 // 60 second timeout
    });
    
    console.log('✅ Recce submission successful!');
    console.log('📸 Response:', JSON.stringify(recceResponse.data, null, 2));
    
    // Check if photos were uploaded
    if (recceResponse.data.store?.recce?.initialPhotos) {
      console.log('\n📷 INITIAL PHOTOS UPLOADED:');
      recceResponse.data.store.recce.initialPhotos.forEach((photo, i) => {
        console.log(`   ${i + 1}. ${photo}`);
      });
    }
    
    if (recceResponse.data.store?.recce?.reccePhotos) {
      console.log('\n📷 RECCE PHOTOS UPLOADED:');
      recceResponse.data.store.recce.reccePhotos.forEach((photo, i) => {
        console.log(`   ${i + 1}. ${photo.photo}`);
      });
    }
    
    // Test URL accessibility
    console.log('\n🌐 Testing URL accessibility...');
    if (recceResponse.data.store?.recce?.initialPhotos?.[0]) {
      const photoPath = recceResponse.data.store.recce.initialPhotos[0];
      const fullUrl = `https://storage.enamorimpex.com/eloraftp/${photoPath}`;
      console.log(`Testing: ${fullUrl}`);
      
      try {
        const urlTest = await axios.head(fullUrl);
        console.log(`✅ URL accessible: ${urlTest.status}`);
      } catch (urlError) {
        console.log(`❌ URL not accessible: ${urlError.response?.status || urlError.message}`);
      }
    }
    
    console.log('\n🎉 Exact API Flow Test COMPLETED!');

  } catch (error) {
    console.error('❌ Exact API Flow Test FAILED:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run test
testExactAPIFlow();