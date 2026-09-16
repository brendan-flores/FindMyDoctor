require('dotenv').config();

// Test the admin API endpoint
async function testAdminAPI() {
  try {
    console.log('🧪 Testing Admin API endpoint...\n');

    // First, we need to get a SUPERADMIN token
    const loginResponse = await fetch('http://localhost:3000/api/v1/auth/login', {
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
    
    if (!loginData.success) {
      console.error('❌ Login failed:', loginData.error);
      return;
    }

    const token = loginData.data.accessToken;
    console.log('✅ SUPERADMIN login successful');
    console.log(`   Token: ${token.substring(0, 20)}...\n`);

    // Test the GET /api/v1/admin/admins endpoint
    console.log('📡 Testing GET /api/v1/admin/admins...');
    const adminsResponse = await fetch('http://localhost:3000/api/v1/admin/admins', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const adminsData = await adminsResponse.json();
    
    if (adminsData.success) {
      console.log('✅ Admin API response successful');
      console.log(`   Total admins returned: ${adminsData.data.length}\n`);
      
      console.log('📊 Admin accounts returned by API:');
      adminsData.data.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.email}`);
        console.log(`   Role: ${admin.role}`);
        console.log(`   Status: ${admin.is_active ? 'Active' : 'Inactive'}`);
        console.log(`   Created: ${admin.created_at}`);
        console.log('');
      });
    } else {
      console.error('❌ Admin API failed:', adminsData.error);
    }

  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

testAdminAPI();