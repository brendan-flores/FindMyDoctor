class Doctor {
  final String id;
  final String userId;
  final String firstName;
  final String? middleName;
  final String lastName;
  final String specialty;
  final String? credentials;
  final String? biography;
  final double consultationFee;
  final bool isApproved;
  final String? practiceName;
  final String? practiceAddress;
  final double? practiceLatitude;
  final double? practiceLongitude;
  final String? practicePhone;
  final String? practiceEmail;
  final String? professionalPhotoUrl;

  Doctor({
    required this.id,
    required this.userId,
    required this.firstName,
    this.middleName,
    required this.lastName,
    required this.specialty,
    this.credentials,
    this.biography,
    required this.consultationFee,
    required this.isApproved,
    this.practiceName,
    this.practiceAddress,
    this.practiceLatitude,
    this.practiceLongitude,
    this.practicePhone,
    this.practiceEmail,
    this.professionalPhotoUrl,
  });

  String get fullName {
    if (middleName != null && middleName!.isNotEmpty) {
      return '$firstName $middleName $lastName';
    }
    return '$firstName $lastName';
  }
  String get clinicName => practiceName ?? 'Private Practice';
  String get clinicAddress => practiceAddress ?? '';
  String? get consultationFeeText => consultationFee > 0 ? consultationFee.toStringAsFixed(0) : null;

  factory Doctor.fromJson(Map<String, dynamic> json) {
    // Helper function to safely convert to double
    double toDouble(dynamic value) {
      if (value == null) return 0.0;
      if (value is double) return value;
      if (value is int) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? 0.0;
      return 0.0;
    }

    return Doctor(
      id: json['id']?.toString() ?? '',
      userId: json['user_id']?.toString() ?? '',
      firstName: json['first_name']?.toString() ?? '',
      middleName: json['middle_name']?.toString(),
      lastName: json['last_name']?.toString() ?? '',
      specialty: json['specialty']?.toString() ?? '',
      credentials: json['credentials']?.toString(),
      biography: json['biography']?.toString(),
      consultationFee: toDouble(json['consultation_fee']),
      isApproved: json['is_approved'] == true,
      practiceName: json['practice_name']?.toString(),
      practiceAddress: json['practice_address']?.toString(),
      practiceLatitude: json['practice_latitude'] != null ? toDouble(json['practice_latitude']) : null,
      practiceLongitude: json['practice_longitude'] != null ? toDouble(json['practice_longitude']) : null,
      practicePhone: json['practice_phone']?.toString(),
      practiceEmail: json['practice_email']?.toString(),
      professionalPhotoUrl: json['professional_photo_url']?.toString(),
    );
  }
}