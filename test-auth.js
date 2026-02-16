const axios = require('axios');

const API_BASE = 'https://elora-api-smoky.vercel.app/api/v1';

async function testAuth() {
  try {
    console.log('Testing login...');
    
    // Test login
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@elora.com',
      password: 'admin123'
    }, {
      withCredentials: true
    });
    
    console.log('Login Response:', {
      status: loginResponse.status,
      data: loginResponse.data,
      cookies: loginResponse.headers['set-cookie']
    });
    
    // Extract token from response
    const token = loginResponse.data.token;
    
    // Test /me endpoint
    console.log('\nTesting /me endpoint...');
    const meResponse = await axios.get(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Me Response:', {
      status: meResponse.status,
      data: meResponse.data
    });
    
    // Test dashboard stats
    console.log('\nTesting dashboard stats...');
    const dashboardResponse = await axios.get(`${API_BASE}/dashboard/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Dashboard Response:', {
      status: dashboardResponse.status,
      dataKeys: Object.keys(dashboardResponse.data)
    });
    
  } catch (error) {
    console.error('Error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
  }
}

testAuth();