import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/theme/app_theme.dart';
import '../core/services/api_service.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/auth/presentation/signup_page.dart';
import '../features/auth/presentation/change_password_page.dart';
import '../features/home/presentation/home_page.dart';
import '../features/doctors/presentation/doctor_schedule_page.dart';
import '../features/doctors/presentation/doctors_page.dart';
import '../features/appointments/presentation/booking_confirmation_page.dart';
import '../features/patients/presentation/patient_details_page.dart';

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  // Static key to allow access to app state from child widgets
  static final GlobalKey<MyAppState> appStateKey = GlobalKey<MyAppState>();

  @override
  State<MyApp> createState() => MyAppState();
}

class MyAppState extends State<MyApp> {
  final ApiService _apiService = ApiService();
  bool _isInitialized = false;
  bool _isAuthenticated = false;
  bool _mustChangePassword = false;

  // Method to update cached authentication state (called after login)
  void updateAuthState(bool isAuthenticated, bool mustChangePassword) {
    if (mounted) {
      setState(() {
        _isAuthenticated = isAuthenticated;
        _mustChangePassword = mustChangePassword;
      });
    }
  }

  // Method to update password change requirement (called after password change)
  void clearPasswordChangeRequirement() {
    if (mounted) {
      setState(() {
        _mustChangePassword = false;
      });
    }
  }

  // Determine initial home widget based on authentication state
  Widget _getInitialHome() {
    if (!_isAuthenticated) {
      return const LoginPage();
    }
    if (_mustChangePassword) {
      return const ChangePasswordPage();
    }
    return const HomePage();
  }

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    var isAuthenticated = false;
    var mustChangePassword = false;

    try {
      // Initialize ApiService to load token from storage
      await _apiService.init();

      // Check if user is logged in
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('access_token');
      isAuthenticated = token != null && token.isNotEmpty;
      mustChangePassword = prefs.getBool('must_change_password') ?? false;
    } catch (_) {
      // Fall through to an unauthenticated state rather than leaving the
      // startup progress indicator spinning forever.
    }

    if (!mounted) return;
    setState(() {
      _isAuthenticated = isAuthenticated;
      _mustChangePassword = mustChangePassword;
      _isInitialized = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return MaterialApp(
        title: 'FindMyDoctor',
        theme: AppTheme.lightTheme,
        home: const Scaffold(body: Center(child: CircularProgressIndicator())),
        debugShowCheckedModeBanner: false,
      );
    }

    return MaterialApp(
      title: 'FindMyDoctor',
      theme: AppTheme.lightTheme,
      home: _getInitialHome(),
      onGenerateRoute: (settings) {
        // Route guards for authentication and password change requirement
        // Use cached state from initialization for synchronous checks
        switch (settings.name) {
          case '/login':
            return MaterialPageRoute(builder: (context) => const LoginPage());
          case '/signup':
            return MaterialPageRoute(builder: (context) => const SignUpPage());
          case '/change-password':
            // Prevent unauthenticated access to password change page
            if (!_isAuthenticated) {
              return MaterialPageRoute(builder: (context) => const LoginPage());
            }
            return MaterialPageRoute(
              builder: (context) => const ChangePasswordPage(),
            );
          case '/home':
          case '/doctors':
          case '/doctor-schedule':
          case '/booking-confirmation':
          case '/patient-details':
            // Protect all authenticated routes - enforce password change requirement
            if (!_isAuthenticated) {
              return MaterialPageRoute(builder: (context) => const LoginPage());
            }
            if (_mustChangePassword) {
              return MaterialPageRoute(
                builder: (context) => const ChangePasswordPage(),
              );
            }
            // Allow navigation to protected routes
            switch (settings.name) {
              case '/home':
                final args = settings.arguments as Map<String, dynamic>?;
                final initialTab = args?['initialTab'] as int?;
                return MaterialPageRoute(
                  builder: (context) => HomePage(initialTab: initialTab),
                );
              case '/doctors':
                return MaterialPageRoute(
                  builder: (context) =>
                      const DoctorsPage(onNavigateToTab: null),
                );
              case '/doctor-schedule':
                final args = settings.arguments as Map<String, dynamic>?;
                return MaterialPageRoute(
                  builder: (context) => DoctorSchedulePage(
                    doctorId: args?['doctorId'] ?? '',
                    doctorName: args?['doctorName'],
                    specialty: args?['specialty'],
                    clinic: args?['clinic'],
                    consultationFee: args?['consultationFee'],
                  ),
                );
              case '/booking-confirmation':
                final args = settings.arguments as Map<String, dynamic>?;
                return MaterialPageRoute(
                  builder: (context) => BookingConfirmationPage(
                    doctorId: args?['doctorId'] ?? '',
                    doctorName: args?['doctorName'],
                    specialty: args?['specialty'],
                    clinic: args?['clinic'],
                    consultationFee: args?['consultationFee'],
                    selectedDate: args?['selectedDate'],
                  ),
                );
              case '/patient-details':
                final args = settings.arguments as Map<String, dynamic>?;
                return MaterialPageRoute(
                  builder: (context) => PatientDetailsPage(
                    doctorId: args?['doctorId'] ?? '',
                    doctorName: args?['doctorName'],
                    specialty: args?['specialty'],
                    clinic: args?['clinic'],
                    consultationFee: args?['consultationFee'],
                    selectedDate: args?['selectedDate'],
                  ),
                );
              default:
                return MaterialPageRoute(
                  builder: (context) => const HomePage(),
                );
            }
          default:
            // Default route - check authentication and password requirement
            if (!_isAuthenticated) {
              return MaterialPageRoute(builder: (context) => const LoginPage());
            }
            if (_mustChangePassword) {
              return MaterialPageRoute(
                builder: (context) => const ChangePasswordPage(),
              );
            }
            return MaterialPageRoute(builder: (context) => const HomePage());
        }
      },
      debugShowCheckedModeBanner: false,
    );
  }
}
