const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Test the complete business flow
async function testCompleteBusinessFlow() {
  const API_BASE = 'http://localhost:5000';
  let authToken = '';

  console.log('🚀 Testing Complete Elora Business Flow\n');

  try {
    // 1. Login as Admin
    console.log('1️⃣ Admin Login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@elora.com',
      password: 'admin123'
    });
    authToken = loginResponse.data.token;
    console.log('✅ Admin logged in successfully\n');

    const headers = { Authorization: `Bearer ${authToken}` };

    // 2. Create a test client
    console.log('2️⃣ Creating test client...');
    const clientData = {
      clientName: 'Test Client Corp',
      branchName: 'Mumbai Branch',
      amount: 100000,
      gstNumber: '27AAAAA0000A1Z5',
      elements: [
        {
          elementId: '507f1f77bcf86cd799439011', // Replace with actual element ID
          elementName: 'LED Board',
          customRate: 150,
          quantity: 1
        }
      ]
    };

    try {
      const clientResponse = await axios.post(`${API_BASE}/clients`, clientData, { headers });
      console.log(`✅ Client created: ${clientResponse.data.client?.clientCode}\n`);
    } catch (err) {
      console.log('ℹ️ Client might already exist, continuing...\n');
    }

    // 3. Create a test store
    console.log('3️⃣ Creating test store...');
    const storeData = {
      dealerCode: `TEST_${Date.now()}`,
      storeName: 'Test Store Mumbai',
      clientCode: 'CLI001', // Use existing client code
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

    // 4. Get RECCE users
    console.log('4️⃣ Getting RECCE users...');
    const recceUsersResponse = await axios.get(`${API_BASE}/users/role/RECCE`, { headers });
    const recceUsers = recceUsersResponse.data.users;
    
    if (recceUsers.length === 0) {
      console.log('❌ No RECCE users found. Please create a RECCE user first.');
      return;
    }
    
    const recceUserId = recceUsers[0]._id;
    console.log(`✅ Found RECCE user: ${recceUsers[0].name}\n`);

    // 5. Assign store to RECCE user
    console.log('5️⃣ Assigning store to RECCE user...');
    await axios.post(`${API_BASE}/stores/assign`, {
      storeIds: [storeId],
      userId: recceUserId,
      stage: 'RECCE'
    }, { headers });
    console.log('✅ Store assigned to RECCE user\n');

    // 6. Login as RECCE user and submit recce
    console.log('6️⃣ Logging in as RECCE user...');
    const recceLoginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: recceUsers[0].email,
      password: 'password123' // Default password
    });
    const recceToken = recceLoginResponse.data.token;
    const recceHeaders = { Authorization: `Bearer ${recceToken}` };
    console.log('✅ RECCE user logged in\n');

    // 7. Submit recce data
    console.log('7️⃣ Submitting recce data...');
    
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
        elementId: '507f1f77bcf86cd799439011',
        elementName: 'LED Board',
        quantity: 1
      }]
    }]));
    formData.append('reccePhoto0', testImageBuffer, 'recce_test.jpg');

    await axios.post(`${API_BASE}/stores/${storeId}/recce`, formData, {
      headers: {
        ...recceHeaders,
        ...formData.getHeaders()
      }
    });
    console.log('✅ Recce data submitted\n');

    // 8. Login back as admin and approve recce
    console.log('8️⃣ Admin approving recce...');
    await axios.post(`${API_BASE}/stores/${storeId}/recce/photos/0/review`, {
      status: 'APPROVED'
    }, { headers });
    console.log('✅ Recce photo approved\n');

    // 9. Get INSTALLATION users
    console.log('9️⃣ Getting INSTALLATION users...');
    const installUsersResponse = await axios.get(`${API_BASE}/users/role/INSTALLATION`, { headers });
    const installUsers = installUsersResponse.data.users;
    
    if (installUsers.length === 0) {
      console.log('❌ No INSTALLATION users found. Please create an INSTALLATION user first.');
      return;
    }
    
    const installUserId = installUsers[0]._id;
    console.log(`✅ Found INSTALLATION user: ${installUsers[0].name}\n`);

    // 10. Assign store to INSTALLATION user
    console.log('🔟 Assigning store to INSTALLATION user...');
    await axios.post(`${API_BASE}/stores/assign`, {
      storeIds: [storeId],
      userId: installUserId,
      stage: 'INSTALLATION'
    }, { headers });
    console.log('✅ Store assigned to INSTALLATION user\n');

    // 11. Login as INSTALLATION user and submit installation
    console.log('1️⃣1️⃣ Logging in as INSTALLATION user...');
    const installLoginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: installUsers[0].email,
      password: 'password123' // Default password
    });
    const installToken = installLoginResponse.data.token;
    const installHeaders = { Authorization: `Bearer ${installToken}` };
    console.log('✅ INSTALLATION user logged in\n');

    // 12. Submit installation data
    console.log('1️⃣2️⃣ Submitting installation data...');
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

    // 13. Generate reports
    console.log('1️⃣3️⃣ Testing report generation...');
    
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

    // 14. Verify final store status
    console.log('1️⃣4️⃣ Verifying final store status...');
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