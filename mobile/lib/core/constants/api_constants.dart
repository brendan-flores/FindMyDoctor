import 'dart:io' show Platform, PlatformException;
import 'package:flutter/foundation.dart' show kIsWeb;
import '../config/local_config.dart';

class ApiConstants {
  // For development on emulator, use localhost
  // For real device testing, use your computer's IP address
  // Example: static const String baseUrl = 'http://192.168.1.100:3000/api/v1';

  // Emulator special IP for Android emulator to access host machine
  static const String _emulatorBaseUrl = 'http://10.0.2.2:3000/api/v1';

  static String get baseUrl {
    // Auto-detect platform and use appropriate base URL
    try {
      // Web platform
      if (kIsWeb) {
        return 'http://localhost:3000/api/v1';
      }

      // Desktop platforms
      if (Platform.isWindows || Platform.isLinux || Platform.isMacOS) {
        return 'http://localhost:3000/api/v1';
      }

      // iOS (simulator)
      if (Platform.isIOS) {
        return 'http://localhost:3000/api/v1';
      }

      // Android - use local_config setting
      if (Platform.isAndroid) {
        try {
          if (LocalConfig.useEmulator) {
            return _emulatorBaseUrl;
          } else {
            return LocalConfig.deviceBaseUrl;
          }
        } catch (e) {
          // If local_config fails, default to emulator IP (most common for development)
          return _emulatorBaseUrl;
        }
      }

      // Fallback
      return 'http://localhost:3000/api/v1';
    } catch (e) {
      return 'http://localhost:3000/api/v1';
    }
  }

  // Auth endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String changePassword = '/auth/change-password';

  // Users endpoints
  static const String usersMe = '/users/me';

  // Doctors endpoints
  static const String doctors = '/doctors';
  static const String doctorDetails = '/doctors';
  static const String patientDoctors = '/patient/doctors';
  static const String doctorProfile = '/profile';
  static const String doctorSchedules = '/schedules';
  static const String doctorAvailability = '/availability';
  static const String doctorCapacity = '/capacity';

  // Clinics endpoints
  static const String clinics = '/clinics';
  static const String clinicDetails = '/clinics';
  static const String clinicLocation = '/location';

  // Appointments endpoints
  static const String appointments = '/appointments';
  static const String appointmentCancel = '/cancel';
  static const String appointmentReschedule = '/reschedule';

  // Queue endpoints
  static const String queue = '/queue';
  static const String queueNext = '/next';
  static const String queueStatus = '/status';
  static const String queueStartCheckup = '/start-checkup';
  static const String queueComplete = '/complete';
  static const String queueSkip = '/skip';
  static const String queueNotPresent = '/not-present';

  // Conversations endpoints
  static const String conversations = '/conversations';
  static const String conversationMessages = '/messages';
  static const String conversationRead = '/read';
  static const String conversationAppointmentSummary = '/appointment-summary';

  // AI Chat endpoints
  static const String aiChat = '/ai/chat';
  static const String aiConversations = '/ai/conversations';
  static const String aiMessages = '/messages';

  // Payments endpoints
  static const String payments = '/payments';
  static const String paymentsById = '/payments';
  static const String paymentReceipt = '/receipt';
  static const String paymentVerify = '/verify';
  static const String paymentReject = '/reject';
  static const String paymentCharges = '/charges';
  static const String paymentGcashQr = '/gcash-qr';

  // Invoices endpoints
  static const String invoices = '/invoices';
  static const String invoiceByPayment = '/invoices/by-payment';
  static const String invoicePdf = '/pdf';

  // Visits endpoints
  static const String visits = '/visits';

  // Prescriptions endpoints
  static const String prescriptions = '/prescriptions';
  static const String patientPrescriptions = '/patients';

  // Notifications endpoints
  static const String notifications = '/notifications';
  static const String notificationRead = '/read';
  static const String notificationsDeviceTokens = '/notifications/device-tokens';

  // Patient OTP endpoints
  static const String patientOtpSend = '/auth/patient/otp/send';
  static const String patientOtpVerify = '/auth/patient/otp/verify';
  static const String patientOtpResend = '/auth/patient/otp/resend';

  // Password reset endpoints
  static const String passwordResetRequest = '/auth/password-reset/request';
  static const String passwordResetVerify = '/auth/password-reset/verify';
  static const String passwordResetReset = '/auth/password-reset/reset';
}