class ApiConstants {
  // For development, use localhost
  // For real device testing, use your computer's IP address
  static const String baseUrl = 'http://localhost:3000/api/v1';
  
  // Auth endpoints
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String changePassword = '/auth/change-password';
  
  // Users endpoints
  static const String usersMe = '/users/me';
  
  // Doctors endpoints
  static const String doctors = '/doctors';
  static const String doctorDetails = '/doctors';
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
  
  // AI Chat endpoints
  static const String aiChat = '/ai/chat';
  static const String aiConversations = '/ai/conversations';
  static const String aiMessages = '/messages';
  
  // Payments endpoints
  static const String payments = '/payments';
  static const String paymentReceipt = '/receipt';
  static const String paymentVerify = '/verify';
  static const String paymentReject = '/reject';
  static const String paymentCharges = '/charges';
  
  // Visits endpoints
  static const String visits = '/visits';
  
  // Prescriptions endpoints
  static const String prescriptions = '/prescriptions';
  static const String patientPrescriptions = '/patients';
  
  // Notifications endpoints
  static const String notifications = '/notifications';
  static const String notificationRead = '/read';
}