# Mobile App Setup Instructions for Team Members

**Important:** The `mobile/lib/core/config/local_config.dart` file must be added to `.gitignore` so each developer can have their own local configuration without committing it to the repository.

## One-Click AI Setup (Recommended)

Just copy this prompt and give it to AI - it will do everything for you:

```
I need to set up local development configuration for a Flutter mobile app. Please do the following:

1. Run the appropriate command to find my computer's local network IP address:
   - On Windows: run 'ipconfig' and read the output
   - On Mac/Linux: run 'ifconfig' or 'ip a' and read the output

2. Identify the IPv4 address from the active network adapter (Wi-Fi or Ethernet, not IPv6)
   - Look for something like: 192.168.x.x or 10.x.x.x

3. Create a new file at: mobile/lib/core/config/local_config.dart

4. Add this file to .gitignore so it's not committed to the repository

5. Add this content to the file, replacing YOUR_IP_HERE with my actual IPv4 address:
```dart
// Local development configuration
// This file is gitignored - each developer should set their own values

class LocalConfig {
  // Your computer's local network IP address for real device testing
  static const String deviceBaseUrl = 'http://YOUR_IP_HERE:3000/api/v1';

  // Set to true when running on Android emulator, false for real device
  static const bool useEmulator = false;
}
```

6. Make sure the format is correct: http://[IP]:3000/api/v1
   For example: http://192.168.1.100:3000/api/v1

Please show me the final file content and confirm it's saved correctly.
```

That's it! AI will handle everything automatically.

## Manual Setup (If AI Fails)

### Step 1: Create Your Local Config File

Create a new file at this location:
```
mobile/lib/core/config/local_config.dart
```

**Important:** This file must be added to `.gitignore` so each developer can have their own local configuration without committing it to the repository.

### Step 2: Find Your IP Address

**Windows:**
- Open Command Prompt or PowerShell
- Run: `ipconfig`
- Look for "IPv4 Address" under your active network adapter (Wi-Fi or Ethernet)
- Example: `192.168.1.100`

**Mac/Linux:**
- Open Terminal
- Run: `ifconfig` or `ip a`
- Look for `inet` address (IPv4)
- Example: `192.168.1.100`

### Step 3: Configure Your File

Copy and paste this content into `local_config.dart`:

```dart
// Local development configuration
// This file is gitignored - each developer should set their own values

class LocalConfig {
  // Your computer's local network IP address for real device testing
  // Find your IP by running 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux)
  // Use the IPv4 address from your active network adapter (Wi-Fi or Ethernet)
  static const String deviceBaseUrl = 'http://YOUR_IP_HERE:3000/api/v1';
  
  // Set to true when running on Android emulator, false for real device
  static const bool useEmulator = false;
}
```

Replace `YOUR_IP_HERE` with your actual IP address (e.g., `192.168.1.100`).

### Step 4: Verify Setup

1. Make sure the backend is running (`cd backend && npm run dev`)
2. Run the Flutter app on your device or emulator
3. Try logging in - it should connect successfully

## Common Issues

**Problem:** App can't connect to backend
**Solution:** 
- Verify your IP address hasn't changed (Wi-Fi might have switched networks)
- Update `deviceBaseUrl` in `local_config.dart` with your new IP
- Make sure backend is running on port 3000

**Problem:** Using Android emulator instead of real device
**Solution:**
- Change `useEmulator = true` in `local_config.dart`
- Change it back to `false` when testing on real device

## Need Help?

If you run into issues, ask a teammate to share their `local_config.dart` as a reference (just don't share your IP publicly).
