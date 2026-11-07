class Prescription {
  final String id;
  final DateTime? prescriptionDate;
  final String doctorFirstName;
  final String doctorLastName;
  final int medicationCount;
  final bool hasPdf;

  Prescription({
    required this.id,
    this.prescriptionDate,
    required this.doctorFirstName,
    required this.doctorLastName,
    required this.medicationCount,
    required this.hasPdf,
  });

  factory Prescription.fromJson(Map<String, dynamic> json) {
    return Prescription(
      id: json['id'] as String,
      prescriptionDate: json['prescription_date'] != null
          ? DateTime.parse(json['prescription_date'] as String)
          : null,
      doctorFirstName: json['doctor_first_name'] as String? ?? '',
      doctorLastName: json['doctor_last_name'] as String? ?? '',
      medicationCount: json['medication_count'] as int? ?? 0,
      hasPdf: json['has_pdf'] as bool? ?? false,
    );
  }
}
