class Message {
  final String id;
  final String conversationId;
  final String senderUserId;
  final String message;
  final DateTime sentAt;
  final DateTime? readAt;
  final String? senderEmail;

  Message({
    required this.id,
    required this.conversationId,
    required this.senderUserId,
    required this.message,
    required this.sentAt,
    this.readAt,
    this.senderEmail,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String,
      senderUserId: json['sender_user_id'] as String,
      message: json['message'] as String,
      sentAt: DateTime.parse(json['sent_at'] as String),
      readAt: json['read_at'] != null
          ? DateTime.parse(json['read_at'] as String)
          : null,
      senderEmail: json['sender_email'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'conversation_id': conversationId,
      'sender_user_id': senderUserId,
      'message': message,
      'sent_at': sentAt.toIso8601String(),
      'read_at': readAt?.toIso8601String(),
      'sender_email': senderEmail,
    };
  }

  bool get isRead => readAt != null;
}
