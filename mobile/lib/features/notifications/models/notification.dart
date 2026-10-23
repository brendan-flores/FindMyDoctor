class Notification {
  final String id;
  final String userId;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime createdAt;
  final String? relatedEntityType;
  final String? relatedEntityId;

  Notification({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    required this.createdAt,
    this.relatedEntityType,
    this.relatedEntityId,
  });

  factory Notification.fromJson(Map<String, dynamic> json) {
    return Notification(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      type: json['type'] as String,
      title: json['title'] as String,
      message: json['message'] as String,
      isRead: json['is_read'] as bool? ?? false,
      createdAt: DateTime.parse(json['created_at'] as String),
      relatedEntityType: json['related_entity_type'] as String?,
      relatedEntityId: json['related_entity_id'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'type': type,
      'title': title,
      'message': message,
      'is_read': isRead,
      'created_at': createdAt.toIso8601String(),
      'related_entity_type': relatedEntityType,
      'related_entity_id': relatedEntityId,
    };
  }

  // Helper to check if notification is payment-related
  bool get isPaymentRelated =>
      type == 'PAYMENT_VERIFIED' || type == 'PAYMENT_REJECTED';

  // Helper to check if notification is message-related
  bool get isMessageRelated =>
      type == 'NEW_SECRETARY_MESSAGE' || type == 'NEW_PATIENT_MESSAGE';
}
