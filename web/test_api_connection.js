// Test API connection from web application perspective
const API_BASE_URL = 'http://localhost:3000/api/v1';

async function testAPIConnection() {
  console.log('🧪 Testing API connection from web application...\n');

  try {
    // Test health endpoint
    console.log('📡 Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE_URL}/../health`);
    console.log('Health status:', healthResponse.ok ? '✅ OK' : '❌ Failed');

    // Test login endpoint
    console.log('\n📡 Testing login endpoint...');
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'superadmin@findmydoctor.local',
        password: 'SuperAdmin@FiDo2024'
      })
    });

    const loginData = await loginResponse.json();
    console.log('Login response:', loginData.success ? '✅ Success' : '❌ Failed');

    if (loginData.success) {
      const token = loginData.data.accessToken;
      console.log('Token received:', token.substring(0, 20) + '...');

      // Test admin API endpoint
      console.log('\n📡 Testing admin API endpoint...');
      const adminsResponse = await fetch(`${API_BASE_URL}/admin/admins`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const adminsData = await adminsResponse.json();
      console.log('Admin API response:', adminsData.success ? '✅ Success' : '❌ Failed');
      
      if (adminsData.success) {
        console.log('Admin count:', adminsData.data.length);
        console.log('Admin data:', adminsData.data);
      } else {
        console.log('Error:', adminsData.error);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testAPIConnection();