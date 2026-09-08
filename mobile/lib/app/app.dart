import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/home/presentation/home_page.dart';
import '../features/doctors/presentation/doctor_schedule_page.dart';
import '../features/appointments/presentation/booking_confirmation_page.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FindMyDoctor',
      theme: AppTheme.lightTheme,
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginPage(),
        '/home': (context) => const HomePage(),
        '/doctor-schedule': (context) => const DoctorSchedulePage(),
        '/booking-confirmation': (context) => const BookingConfirmationPage(),
      },
      debugShowCheckedModeBanner: false,
    );
  }
}