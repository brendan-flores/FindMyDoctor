import '../../../core/utils/json_parsers.dart';

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
      // medication_count is a COUNT(*) (PostgreSQL bigint), which the
      // node-postgres driver delivers as a JSON string - parse it instead
      // of casting (`as int?` throws and fails the whole list load).
      medicationCount: parseInt(json['medication_count']) ?? 0,
      // has_pdf comes from a CASE WHEN boolean expression, but tolerate
      // 'true'/'false' strings as well.
      hasPdf: json['has_pdf'] == true ||
          json['has_pdf']?.toString().toLowerCase() == 'true',
    );
  }
}
