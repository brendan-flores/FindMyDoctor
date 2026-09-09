class Doctor {
  final String id;
  final String userId;
  final String? clinicId;
  final String firstName;
  final String lastName;
  final String specialty;
  final String? credentials;
  final String? biography;
  final double consultationFee;
  final bool isApproved;
  final String? clinicName;
  final String? clinicAddress;
  final double? latitude;
  final double? longitude;

  Doctor({
    required this.id,
    required this.userId,
    this.clinicId,
    required this.firstName,
    required this.lastName,
    required this.specialty,
    this.credentials,
    this.biography,
    required this.consultationFee,
    required this.isApproved,
    this.clinicName,
    this.clinicAddress,
    this.latitude,
    this.longitude,
  });

  factory Doctor.fromJson(Map<String, dynamic> json) {
    return Doctor(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      clinicId: json['clinic_id'],
      firstName: json['first_name'] ?? '',
      lastName: json['last_name'] ?? '',
      specialty: json['specialty'] ?? '',
      credentials: json['credentials'],
      biography: json['biography'],
      consultationFee: (json['consultation_fee'] ?? 0).toDouble(),
      isApproved: json['is_approved'] ?? false,
      clinicName: json['clinic_name'],
      clinicAddress: json['clinic_address'],
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
    );
  }
}