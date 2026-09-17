require('dotenv').config();

// Test the create admin functionality
async function testCreateAdmin() {
  try {
    console.log('🧪 Testing create admin functionality...\n');

    // First, login as SUPERADMIN
    console.log('📡 Logging in as SUPERADMIN...');
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
    console.log('✅ SUPERADMIN login successful\n');

    // Test creating a new admin
    console.log('📡 Creating new admin account...');
    const testEmail = `testadmin${Date.now()}@findmydoctor.local`;
    const testPassword = 'TestAdmin@2024';

    const createResponse = await fetch('http://localhost:3000/api/v1/admin/admins', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });

    const createData = await createResponse.json();
    console.log('Create admin response:', createData);

    if (createData.success) {
      console.log('✅ Admin account created successfully!');
      console.log(`   Email: ${createData.data.email}`);
      console.log(`   Role: ${createData.data.role}`);
      console.log(`   ID: ${createData.data.id}\n`);

      // Verify it appears in the admin list
      console.log('📡 Verifying admin appears in list...');
      const listResponse = await fetch('http://localhost:3000/api/v1/admin/admins', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });

      const listData = await listResponse.json();
      
      if (listData.success) {
        console.log('✅ Admin list retrieved successfully');
        console.log(`   Total admins: ${listData.data.length}`);
        
        const newAdmin = listData.data.find((admin) => admin.email === testEmail);
        if (newAdmin) {
          console.log('✅ New admin appears in the list!');
          console.log(`   Email: ${newAdmin.email}`);
          console.log(`   Role: ${newAdmin.role}`);
        } else {
          console.log('❌ New admin not found in the list');
        }
      }
    } else {
      console.error('❌ Create admin failed:', createData.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCreateAdmin();