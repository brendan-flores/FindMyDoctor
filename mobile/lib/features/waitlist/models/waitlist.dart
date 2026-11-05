class Waitlist {
  final String id;
  final String doctorId;
  final String doctorFirstName;
  final String doctorLastName;
  final String? doctorSpecialty;
  final String? doctorPracticeName;
  final String waitlistDate;
  final String status;
  final int position;
  final String? offeredAt;
  final String? expiresAt;
  final String createdAt;
  final String updatedAt;

  Waitlist({
    required this.id,
    required this.doctorId,
    required this.doctorFirstName,
    required this.doctorLastName,
    this.doctorSpecialty,
    this.doctorPracticeName,
    required this.waitlistDate,
    required this.status,
    required this.position,
    this.offeredAt,
    this.expiresAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Waitlist.fromMap(Map<String, dynamic> map) {
    return Waitlist(
      id: map['id'] as String,
      doctorId: map['doctor_id'] as String,
      doctorFirstName: map['doctor_first_name'] as String,
      doctorLastName: map['doctor_last_name'] as String,
      doctorSpecialty: map['specialty'] as String?,
      doctorPracticeName: map['practice_name'] as String?,
      waitlistDate: map['waitlist_date'] as String,
      status: map['status'] as String,
      position: map['position'] as int,
      offeredAt: map['offered_at'] as String?,
      expiresAt: map['expires_at'] as String?,
      createdAt: map['created_at'] as String,
      updatedAt: map['updated_at'] as String,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'doctor_id': doctorId,
      'doctor_first_name': doctorFirstName,
      'doctor_last_name': doctorLastName,
      'specialty': doctorSpecialty,
      'practice_name': doctorPracticeName,
      'waitlist_date': waitlistDate,
      'status': status,
      'position': position,
      'offered_at': offeredAt,
      'expires_at': expiresAt,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }

  String get doctorName => '$doctorFirstName $doctorLastName';

  bool get isWaiting => status == 'WAITING';
  bool get isOffered => status == 'OFFERED';
  bool get isConverted => status == 'CONVERTED';
  bool get isExpired => status == 'EXPIRED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isActive => isWaiting || isOffered;

  String getTimeRemaining() {
    if (expiresAt == null) return '';
    final expiryDate = DateTime.tryParse(expiresAt!);
    if (expiryDate == null) return '';
    final now = DateTime.now();
    final difference = expiryDate.difference(now);

    if (difference.isNegative) {
      return 'Expired';
    } else if (difference.inDays > 0) {
      return '${difference.inDays}d ${difference.inHours % 24}h remaining';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ${difference.inMinutes % 60}m remaining';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m remaining';
    } else {
      return 'Less than 1m remaining';
    }
  }
}
