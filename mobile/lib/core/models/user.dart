class User {
  final String id;
  final String email;
  final String role;
  final bool mustChangePassword;

  User({
    required this.id,
    required this.email,
    required this.role,
    required this.mustChangePassword,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      email: json['email'] ?? '',
      role: json['role'] ?? '',
      mustChangePassword: json['mustChangePassword'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'role': role,
      'mustChangePassword': mustChangePassword,
    };
  }
}

class Patient {
  final String id;
  final String userId;
  final String firstName;
  final String lastName;
  final String? dateOfBirth;
  final String? phone;
  final String? address;
  final String? emergencyContactName;
  final String? emergencyContactPhone;
  final String? medicalHistory;
  final String? allergies;
  final String? currentMedications;

  Patient({
    required this.id,
    required this.userId,
    required this.firstName,
    required this.lastName,
    this.dateOfBirth,
    this.phone,
    this.address,
    this.emergencyContactName,
    this.emergencyContactPhone,
    this.medicalHistory,
    this.allergies,
    this.currentMedications,
  });

  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      firstName: json['first_name'] ?? '',
      lastName: json['last_name'] ?? '',
      dateOfBirth: json['date_of_birth'],
      phone: json['phone'],
      address: json['address'],
      emergencyContactName: json['emergency_contact_name'],
      emergencyContactPhone: json['emergency_contact_phone'],
      medicalHistory: json['medical_history'],
      allergies: json['allergies'],
      currentMedications: json['current_medications'],
    );
  }
}

class Appointment {
  final String id;
  final String patientId;
  final String doctorId;
  final String clinicId;
  final DateTime appointmentDate;
  final DateTime? endTime;
  final String status;
  final String? reasonForVisit;
  final String? notes;
  final String? doctorFirstName;
  final String? doctorLastName;
  final String? doctorSpecialty;
  final String? clinicName;
  final int? queueNumber;
  final String? queueStatus;

  Appointment({
    required this.id,
    required this.patientId,
    required this.doctorId,
    required this.clinicId,
    required this.appointmentDate,
    this.endTime,
    required this.status,
    this.reasonForVisit,
    this.notes,
    this.doctorFirstName,
    this.doctorLastName,
    this.doctorSpecialty,
    this.clinicName,
    this.queueNumber,
    this.queueStatus,
  });

  factory Appointment.fromJson(Map<String, dynamic> json) {
    return Appointment(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? '',
      doctorId: json['doctor_id'] ?? '',
      clinicId: json['clinic_id'] ?? '',
      appointmentDate: DateTime.parse(json['appointment_date']),
      endTime: json['end_time'] != null ? DateTime.parse(json['end_time']) : null,
      status: json['status'] ?? '',
      reasonForVisit: json['reason_for_visit'],
      notes: json['notes'],
      doctorFirstName: json['doctor_first_name'],
      doctorLastName: json['doctor_last_name'],
      doctorSpecialty: json['specialty'],
      clinicName: json['clinic_name'],
      queueNumber: json['queue_number'],
      queueStatus: json['queue_status'],
    );
  }
}