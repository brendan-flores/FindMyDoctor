import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/theme/app_theme.dart';
import '../core/services/api_service.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/auth/presentation/signup_page.dart';
import '../features/home/presentation/home_page.dart';
import '../features/doctors/presentation/doctor_schedule_page.dart';
import '../features/doctors/presentation/doctors_page.dart';
import '../features/appointments/presentation/booking_confirmation_page.dart';

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final ApiService _apiService = ApiService();
  bool _isInitialized = false;
  String? _initialRoute;

  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  Future<void> _initializeApp() async {
    // Initialize ApiService to load token from storage
    await _apiService.init();

    // Check if user is logged in
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('access_token');

    setState(() {
      _isInitialized = true;
      _initialRoute = token != null && token.isNotEmpty ? '/home' : '/login';
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return MaterialApp(
        title: 'FindMyDoctor',
        theme: AppTheme.lightTheme,
        home: const Scaffold(
          body: Center(
            child: CircularProgressIndicator(),
          ),
        ),
        debugShowCheckedModeBanner: false,
      );
    }

    return MaterialApp(
      title: 'FindMyDoctor',
      theme: AppTheme.lightTheme,
      home: _initialRoute == '/home' ? const HomePage() : const LoginPage(),
      routes: {
        '/login': (context) => const LoginPage(),
        '/signup': (context) => const SignUpPage(),
        '/home': (context) => const HomePage(),
        '/doctors': (context) => const DoctorsPage(onNavigateToTab: null),
        '/doctor-schedule': (context) => const DoctorSchedulePage(),
        '/booking-confirmation': (context) => const BookingConfirmationPage(),
      },
      debugShowCheckedModeBanner: false,
    );
  }
}