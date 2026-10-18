# FindMyDoctor Mobile

The FindMyDoctor Flutter patient mobile application. Run Flutter commands from this directory.

## Features

- **Patient Registration**: Email OTP verification with staged signup flow
- **Doctor Search**: Search doctors by name, specialty, or practice
- **Doctor Profiles**: View doctor details, credentials, biography, and consultation fees
- **Week-Only Scheduling**: View and book appointments for the current week only
- **Appointment Booking**: Atomic booking with capacity enforcement
- **Queue Position Display**: Shows "You are patient #X out of Y" with configured capacity
- **Appointment Management**: View upcoming appointments, cancel with queue reassignment
- **Queue Notifications**: Receive notifications when queue number changes
- **Patient-Secretary Chat**: Secure messaging with the doctor's secretary
- **AI Chatbot**: Medical information assistant
- **Navigation**: Bottom navigation with Home, Doctors, Appointments, Chat, and Profile tabs

## Source Layout

```text
lib/
+-- app/                 # App composition, routing, and theme
|   +-- app.dart         # App entry point with bottom navigation
+-- core/                # Shared infrastructure and reusable primitives
|   +-- services/        # API service, doctor service, auth service
|   +-- models/          # Data models (Doctor, Appointment, User, etc.)
|   +-- theme/           # App theme and colors
+-- features/            # Feature-owned screens, state, models, and data access
|   +-- auth/            # Login, registration, OTP verification
|   +-- doctors/         # Doctor search, profiles, schedule, booking
|   +-- appointments/    # Appointments list, booking confirmation
|   +-- chat/            # Patient-secretary chat, AI chatbot
|   +-- home/            # Home page with quick actions
|   +-- profile/         # User profile management
+-- main.dart            # Process entrypoint
```

## Architecture

- Feature code stays inside its feature directory
- API calls belong in the core services layer and target the backend REST API
- The app must not connect directly to PostgreSQL or an external AI provider
- All data operations go through the backend API at `http://10.0.2.2:3000/api/v1` (emulator)

## Getting Started

### Prerequisites
- Flutter SDK (3.0+)
- Dart SDK
- Android Studio / Xcode for mobile emulation
- Backend server running on port 3000

### Installation

1. **Install dependencies**:
```bash
cd mobile
flutter pub get
```

2. **Run the app**:
```bash
flutter run
```

3. **For Android emulator**:
- Ensure the backend is accessible at `http://10.0.2.2:3000`
- The app is configured to use this host for emulator requests

### Development Resources

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)
- [Flutter documentation](https://docs.flutter.dev/)

## Important Notes

- The mobile app communicates with the backend REST API only
- Never connect directly to PostgreSQL or external AI providers
- AI API keys and database credentials are backend-only
- Patient-doctor direct chat is not allowed (enforced at API level)
- All authentication and authorization is handled by the backend
