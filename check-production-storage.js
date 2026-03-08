const axios = require('axios');

async function checkProductionStorageType() {
  console.log('🔍 Checking Production Storage Configuration\n');
  
  try {
    // Test endpoint to check storage configuration
    const response = await axios.get('https://elora-api-smoky.vercel.app/api/v1/health');
    console.log('API Health Response:', response.data);
  } catch (error) {
    console.log('Health check failed:', error.message);
  }
  
  // Check if there's a debug endpoint
  try {
    const debugResponse = await axios.get('https://elora-api-smoky.vercel.app/api/v1/debug/storage');
    console.log('Storage Debug Response:', debugResponse.data);
  } catch (error) {
    console.log('No debug endpoint available');
  }
}

checkProductionStorageType();