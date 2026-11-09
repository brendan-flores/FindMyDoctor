class Message {
  final String id;
  final String conversationId;
  final String senderUserId;
  final String message;
  final DateTime sentAt;
  final DateTime? readAt;
  final String? senderEmail;
  final String? messageType; // 'TEXT' or 'INVOICE'
  final String? invoiceId;
  final InvoiceSummary? invoice;

  Message({
    required this.id,
    required this.conversationId,
    required this.senderUserId,
    required this.message,
    required this.sentAt,
    this.readAt,
    this.senderEmail,
    this.messageType,
    this.invoiceId,
    this.invoice,
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
      messageType: json['message_type'] as String?,
      invoiceId: json['invoice_id'] as String?,
      invoice: json['invoice'] != null
          ? InvoiceSummary.fromJson(json['invoice'] as Map<String, dynamic>)
          : null,
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
      'message_type': messageType,
      'invoice_id': invoiceId,
      'invoice': invoice?.toJson(),
    };
  }

  bool get isRead => readAt != null;
  bool get isInvoice => messageType == 'INVOICE';
}

class InvoiceSummary {
  final String id;
  final String invoiceNumber;
  final String? invoiceDate;
  final double? totalAmount;
  final String? status;

  InvoiceSummary({
    required this.id,
    required this.invoiceNumber,
    this.invoiceDate,
    this.totalAmount,
    this.status,
  });

  factory InvoiceSummary.fromJson(Map<String, dynamic> json) {
    return InvoiceSummary(
      id: json['id'] as String,
      invoiceNumber: json['invoice_number'] as String,
      invoiceDate: json['invoice_date'] as String?,
      totalAmount: json['total_amount'] != null
          ? (json['total_amount'] is String
              ? double.tryParse(json['total_amount'] as String)
              : json['total_amount'] as double?)
          : null,
      status: json['status'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'invoice_number': invoiceNumber,
      'invoice_date': invoiceDate,
      'total_amount': totalAmount,
      'status': status,
    };
  }
}
