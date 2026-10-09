const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3000/api/v1';

// Test the availability endpoint
async function testAvailability() {
  // First, get a list of doctors to get a valid doctor ID
  console.log('1. Fetching doctors list...');
  await makeRequest('/doctors', 'GET', null, (data) => {
    if (data.success && data.data && data.data.length > 0) {
      const doctorId = data.data[0].id;
      const doctorName = data.data[0].first_name + ' ' + data.data[0].last_name;
      console.log(`✓ Found doctor: ${doctorName} (ID: ${doctorId})`);
      
      // Test availability for a specific date
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      
      console.log(`\n2. Testing availability for date: ${dateStr}`);
      makeRequest(`/doctors/${doctorId}/availability?date=${dateStr}`, 'GET', null, (data) => {
        console.log('✓ Single date availability response:');
        console.log(JSON.stringify(data, null, 2));
      });
      
      // Test availability for a date range (current month)
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const startDate = firstDay.toISOString().split('T')[0];
      const endDate = lastDay.toISOString().split('T')[0];
      
      console.log(`\n3. Testing availability for date range: ${startDate} to ${endDate}`);
      makeRequest(`/doctors/${doctorId}/availability?startDate=${startDate}&endDate=${endDate}`, 'GET', null, (data) => {
        console.log('✓ Date range availability response:');
        console.log(JSON.stringify(data, null, 2));
        
        // Analyze the response
        if (data.success && data.data && data.data.dates) {
          const dates = data.data.dates;
          console.log(`\n4. Summary of ${dates.length} dates:`);
          
          const statusCounts = {
            AVAILABLE: 0,
            FULL: 0,
            UNAVAILABLE: 0,
            PAST: 0,
            NON_WORKING: 0
          };
          
          dates.forEach(date => {
            statusCounts[date.status]++;
            if (date.status === 'AVAILABLE' && date.timeSlots && date.timeSlots.length > 0) {
              const availableSlots = date.timeSlots.filter(slot => slot.isAvailable);
              console.log(`  ${date.date}: ${date.status} - ${availableSlots.length} available slots`);
            }
          });
          
          console.log('\n5. Status distribution:');
          Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`  ${status}: ${count}`);
          });
        }
      });
    } else {
      console.log('✗ No doctors found in the database');
      console.log('Please seed the database with sample data first');
    }
  });
}

function makeRequest(path, method, body, callback) {
  const url = new URL(BASE_URL + path);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 3000,
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        callback(parsed);
      } catch (e) {
        console.error('✗ Failed to parse response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('✗ Request failed:', error.message);
    console.log('Make sure the backend server is running on port 3000');
  });

  if (body) {
    req.write(JSON.stringify(body));
  }

  req.end();
}

console.log('Testing Availability API Endpoint');
console.log('==================================\n');
console.log('Make sure the backend server is running: npm run dev\n');

testAvailability();
