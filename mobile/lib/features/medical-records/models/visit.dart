class Visit {
  final String id;
  final DateTime? visitDate;
  final String? diagnosis;
  final String? notes;
  final String doctorFirstName;
  final String doctorLastName;
  final String? appointmentId;

  Visit({
    required this.id,
    this.visitDate,
    this.diagnosis,
    this.notes,
    required this.doctorFirstName,
    required this.doctorLastName,
    this.appointmentId,
  });

  factory Visit.fromJson(Map<String, dynamic> json) {
    return Visit(
      id: json['id'] as String,
      visitDate: json['visit_date'] != null
          ? DateTime.parse(json['visit_date'] as String)
          : null,
      diagnosis: json['diagnosis'] as String?,
      notes: json['notes'] as String?,
      doctorFirstName: json['doctor_first_name'] as String? ?? '',
      doctorLastName: json['doctor_last_name'] as String? ?? '',
      appointmentId: json['appointment_id'] as String?,
    );
  }
}
