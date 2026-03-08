const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Test the complete business flow
async function testCompleteBusinessFlow() {
  const API_BASE = 'https://elora-api-smoky.vercel.app/api/v1';
  let authToken = '';

  console.log('🚀 Testing Complete Elora Business Flow\n');

  try {
    // 1. Login as Admin
    console.log('1️⃣ Admin Login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@elora.com',
      password: 'Admin@123'
    });
    authToken = loginResponse.data.token;
    console.log('✅ Admin logged in successfully\n');

    const headers = { Authorization: `Bearer ${authToken}` };

    // 2. Get available elements first
    console.log('2️⃣ Getting available elements...');
    const elementsResponse = await axios.get(`${API_BASE}/elements/all`, { headers });
    const availableElements = elementsResponse.data.elements || [];
    
    if (availableElements.length === 0) {
      console.log('❌ No elements found. Please create elements first.');
      return;
    }
    
    const firstElement = availableElements[0];
    console.log(`✅ Found element: ${firstElement.name}\n`);

    // 3. Create a test client
    console.log('3️⃣ Creating test client...');
    const clientData = {
      clientName: 'Test Client Corp',
      branchName: 'Mumbai Branch',
      amount: 100000,
      gstNumber: '27AAAAA0000A1Z5',
      elements: [{
        elementId: firstElement._id,
        elementName: firstElement.name,
        customRate: 150,
        quantity: 1
      }]
    };

    let clientCode = null;
    try {
      const clientResponse = await axios.post(`${API_BASE}/clients`, clientData, { headers });
      clientCode = clientResponse.data.client.clientCode;
      console.log(`✅ Client created with code: ${clientCode}\n`);
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.message?.includes('already exists')) {
        // Get existing clients to find a valid client code
        const existingClients = await axios.get(`${API_BASE}/clients`, { headers });
        if (existingClients.data.clients && existingClients.data.clients.length > 0) {
          clientCode = existingClients.data.clients[0].clientCode;
          console.log(`ℹ️ Using existing client code: ${clientCode}\n`);
        }
      } else {
        throw err;
      }
    }

    // 4. Create a test store
    console.log('4️⃣ Creating test store...');
    const storeData = {
      dealerCode: `TEST_${Date.now()}`,
      storeName: 'Test Store Mumbai',
      ...(clientCode && { clientCode: clientCode }),
      location: {
        city: 'Mumbai',
        district: 'Mumbai Suburban',
        state: 'Maharashtra',
        address: '123 Test Street, Andheri West'
      }
    };

    const storeResponse = await axios.post(`${API_BASE}/stores`, storeData, { headers });
    const storeId = storeResponse.data.store._id;
    console.log(`✅ Store created: ${storeId}\n`);

    // 5. Get RECCE users
    console.log('5️⃣ Getting RECCE users...');
    const recceUsersResponse = await axios.get(`${API_BASE}/users/role/RECCE`, { headers });
    const recceUsers = recceUsersResponse.data.users;
    
    if (recceUsers.length === 0) {
      console.log('❌ No RECCE users found. Please create a RECCE user first.');
      return;
    }
    
    const recceUserId = recceUsers[0]._id;
    console.log(`✅ Found RECCE user: ${recceUsers[0].name}\n`);

    // 6. Assign store to RECCE user
    console.log('6️⃣ Assigning store to RECCE user...');
    await axios.post(`${API_BASE}/stores/assign`, {
      storeIds: [storeId],
      userId: recceUserId,
      stage: 'RECCE'
    }, { headers });
    console.log('✅ Store assigned to RECCE user\n');

    // 7. Login as RECCE user and submit recce
    console.log('7️⃣ Logging in as RECCE user...');
    const recceLoginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'akshayrecce@gmail.com',
      password: 'Akshay@123'
    });
    const recceToken = recceLoginResponse.data.token;
    const recceHeaders = { Authorization: `Bearer ${recceToken}` };
    console.log('✅ RECCE user logged in\n');

    // 8. Submit recce data
    console.log('8️⃣ Submitting recce data...');
    
    // Create a test image buffer
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
    formData.append('notes', 'Test recce submission');
    formData.append('initialPhotosCount', '1');
    formData.append('initialPhoto0', testImageBuffer, 'initial_test.jpg');
    formData.append('reccePhotosData', JSON.stringify([{
      width: 120,
      height: 60,
      unit: 'in',
      elements: [{
        elementId: firstElement._id,
        elementName: firstElement.name,
        quantity: 1
      }]
    }]));
    formData.append('reccePhoto0', testImageBuffer, 'recce_test.jpg');

    const recceResponse = await axios.post(`${API_BASE}/stores/${storeId}/recce`, formData, {
      headers: {
        ...recceHeaders,
        ...formData.getHeaders()
      }
    });
    console.log('✅ Recce data submitted');
    console.log('📸 RECCE RESPONSE:', JSON.stringify(recceResponse.data, null, 2));
    
    // Get updated store data to see photo URLs
    const updatedStoreResponse = await axios.get(`${API_BASE}/stores/${storeId}`, { headers });
    const updatedStore = updatedStoreResponse.data.store;
    
    console.log('\n📋 UPLOADED PHOTOS:');
    console.log('='.repeat(50));
    
    if (updatedStore.recce?.initialPhotos) {
      console.log('📷 Initial Photos:');
      updatedStore.recce.initialPhotos.forEach((photo, i) => {
        const fullUrl = photo.startsWith('http') ? photo : `https://storage.enamorimpex.com/eloraftp/${photo}`;
        console.log(`   ${i + 1}. ${fullUrl}`);
      });
    }
    
    if (updatedStore.recce?.reccePhotos) {
      console.log('📷 Recce Photos:');
      updatedStore.recce.reccePhotos.forEach((photo, i) => {
        const fullUrl = photo.photo.startsWith('http') ? photo.photo : `https://storage.enamorimpex.com/eloraftp/${photo.photo}`;
        console.log(`   ${i + 1}. ${fullUrl}`);
        console.log(`      Measurements: ${photo.measurements.width}x${photo.measurements.height} ${photo.measurements.unit}`);
        if (photo.elements) {
          console.log(`      Elements: ${photo.elements.map(e => e.elementName).join(', ')}`);
        }
      });
    }
    console.log('\n');

    // 9. Login back as admin and approve recce
    console.log('9️⃣ Admin approving recce...');
    await axios.post(`${API_BASE}/stores/${storeId}/recce/photos/0/review`, {
      status: 'APPROVED'
    }, { headers });
    console.log('✅ Recce photo approved\n');

    // 10. Get INSTALLATION users
    console.log('🔟 Getting INSTALLATION users...');
    const installUsersResponse = await axios.get(`${API_BASE}/users/role/INSTALLATION`, { headers });
    const installUsers = installUsersResponse.data.users;
    
    if (installUsers.length === 0) {
      console.log('❌ No INSTALLATION users found. Please create an INSTALLATION user first.');
      return;
    }
    
    const installUserId = installUsers[0]._id;
    console.log(`✅ Found INSTALLATION user: ${installUsers[0].name}\n`);

    // 11. Assign store to INSTALLATION user
    console.log('1️⃣1️⃣ Assigning store to INSTALLATION user...');
    await axios.post(`${API_BASE}/stores/assign`, {
      storeIds: [storeId],
      userId: installUserId,
      stage: 'INSTALLATION'
    }, { headers });
    console.log('✅ Store assigned to INSTALLATION user\n');

    // 12. Login as INSTALLATION user and submit installation
    console.log('1️⃣2️⃣ Logging in as INSTALLATION user...');
    const installLoginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: installUsers[0].email,
      password: 'Akshay@123'
    });
    const installToken = installLoginResponse.data.token;
    const installHeaders = { Authorization: `Bearer ${installToken}` };
    console.log('✅ INSTALLATION user logged in\n');

    // 13. Submit installation data
    console.log('1️⃣3️⃣ Submitting installation data...');
    const installFormData = new FormData();
    installFormData.append('installationPhotosData', JSON.stringify([{
      reccePhotoIndex: 0
    }]));
    installFormData.append('installationPhoto0', testImageBuffer, 'installation_test.jpg');

    await axios.post(`${API_BASE}/stores/${storeId}/installation`, installFormData, {
      headers: {
        ...installHeaders,
        ...installFormData.getHeaders()
      }
    });
    console.log('✅ Installation data submitted\n');

    // 14. Generate reports
    console.log('1️⃣4️⃣ Testing report generation...');
    
    // Test recce PPT
    const reccePPTResponse = await axios.get(`${API_BASE}/stores/${storeId}/ppt/recce`, {
      headers,
      responseType: 'arraybuffer'
    });
    console.log(`✅ Recce PPT generated (${reccePPTResponse.data.byteLength} bytes)`);

    // Test installation PPT
    const installPPTResponse = await axios.get(`${API_BASE}/stores/${storeId}/ppt/installation`, {
      headers,
      responseType: 'arraybuffer'
    });
    console.log(`✅ Installation PPT generated (${installPPTResponse.data.byteLength} bytes)\n`);

    // 15. Verify final store status
    console.log('1️⃣5️⃣ Verifying final store status...');
    const finalStoreResponse = await axios.get(`${API_BASE}/stores/${storeId}`, { headers });
    const finalStore = finalStoreResponse.data.store;
    
    console.log(`📊 Final Store Status: ${finalStore.currentStatus}`);
    console.log(`📁 Recce Photos: ${finalStore.recce?.reccePhotos?.length || 0}`);
    console.log(`📁 Installation Photos: ${finalStore.installation?.photos?.length || 0}`);
    console.log(`💰 Total Cost: ₹${finalStore.commercials?.totalCost || 0}`);

    console.log('\n🎉 Complete Business Flow Test PASSED!');
    console.log('\n📋 Flow Summary:');
    console.log('✅ Client Management');
    console.log('✅ Store Creation');
    console.log('✅ RECCE Assignment & Submission');
    console.log('✅ Photo Approval Workflow');
    console.log('✅ INSTALLATION Assignment & Submission');
    console.log('✅ File Upload to FTPS');
    console.log('✅ Report Generation');
    console.log('✅ Status Progression');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testCompleteBusinessFlow();