class Conversation {
  final String id;
  final String patientId;
  final String secretaryId;
  final String doctorId;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final String secretaryFirstName;
  final String secretaryLastName;
  final String doctorFirstName;
  final String doctorLastName;
  final String? practiceName;
  final String? doctorProfessionalPhotoUrl;
  final int unreadCount;
  final String? lastMessagePreview;
  final DateTime? lastMessageSentAt;

  Conversation({
    required this.id,
    required this.patientId,
    required this.secretaryId,
    required this.doctorId,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.secretaryFirstName,
    required this.secretaryLastName,
    required this.doctorFirstName,
    required this.doctorLastName,
    this.practiceName,
    this.doctorProfessionalPhotoUrl,
    required this.unreadCount,
    this.lastMessagePreview,
    this.lastMessageSentAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as String,
      patientId: json['patient_id'] as String,
      secretaryId: json['secretary_id'] as String,
      doctorId: json['doctor_id'] as String,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      secretaryFirstName: json['secretary_first_name'] as String,
      secretaryLastName: json['secretary_last_name'] as String,
      doctorFirstName: json['doctor_first_name'] as String,
      doctorLastName: json['doctor_last_name'] as String,
      practiceName: json['practice_name'] as String?,
      doctorProfessionalPhotoUrl: json['doctor_professional_photo_url']?.toString(),
      unreadCount: json['unread_count'] != null
          ? int.tryParse(json['unread_count'].toString()) ?? 0
          : 0,
      lastMessagePreview: json['last_message_preview'] as String?,
      lastMessageSentAt: json['last_message_sent_at'] != null
          ? DateTime.parse(json['last_message_sent_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patient_id': patientId,
      'secretary_id': secretaryId,
      'doctor_id': doctorId,
      'status': status,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'secretary_first_name': secretaryFirstName,
      'secretary_last_name': secretaryLastName,
      'doctor_first_name': doctorFirstName,
      'doctor_last_name': doctorLastName,
      'practice_name': practiceName,
      'doctor_professional_photo_url': doctorProfessionalPhotoUrl,
      'unread_count': unreadCount,
      'last_message_preview': lastMessagePreview,
      'last_message_sent_at': lastMessageSentAt?.toIso8601String(),
    };
  }

  String get secretaryName => '$secretaryFirstName $secretaryLastName';
  String get doctorName => '$doctorFirstName $doctorLastName';
}
