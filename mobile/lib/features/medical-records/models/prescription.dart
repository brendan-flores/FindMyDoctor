import '../../../core/utils/json_parsers.dart';

/// A prescription list row returned by `GET /api/v1/prescriptions/me` (and the
/// doctor-facing prescription history endpoints).
class Prescription {
  final String id;
  final DateTime? prescriptionDate;
  final String doctorFirstName;
  final String doctorMiddleName;
  final String doctorLastName;
  final String? doctorSpecialty;
  final String? doctorProfessionalPhotoUrl;
  final String? practiceName;
  final String? roomNumber;
  final int medicationCount;
  final bool hasPdf;
  final String? status;

  Prescription({
    required this.id,
    this.prescriptionDate,
    required this.doctorFirstName,
    this.doctorMiddleName = '',
    required this.doctorLastName,
    this.doctorSpecialty,
    this.doctorProfessionalPhotoUrl,
    this.practiceName,
    this.roomNumber,
    required this.medicationCount,
    required this.hasPdf,
    this.status,
  });

  factory Prescription.fromJson(Map<String, dynamic> json) {
    return Prescription(
      id: json['id'] as String,
      prescriptionDate: json['prescription_date'] != null
          ? DateTime.parse(json['prescription_date'] as String)
          : null,
      doctorFirstName: json['doctor_first_name'] as String? ?? '',
      doctorMiddleName: json['doctor_middle_name'] as String? ?? '',
      doctorLastName: json['doctor_last_name'] as String? ?? '',
      doctorSpecialty: parseString(json['doctor_specialty']),
      doctorProfessionalPhotoUrl:
          parseString(json['doctor_professional_photo_url']),
      practiceName: parseString(json['practice_name']),
      roomNumber: parseString(json['room_number']),
      // medication_count is a COUNT(*) (PostgreSQL bigint), which the
      // node-postgres driver delivers as a JSON string - parse it instead
      // of casting (`as int?` throws and fails the whole list load).
      medicationCount: parseInt(json['medication_count']) ?? 0,
      // has_pdf comes from a CASE WHEN boolean expression, but tolerate
      // 'true'/'false' strings as well.
      hasPdf: json['has_pdf'] == true ||
          json['has_pdf']?.toString().toLowerCase() == 'true',
      status: parseString(json['status']),
    );
  }

  /// Full name without the "Dr." prefix.
  String get doctorFullName => [doctorFirstName, doctorMiddleName, doctorLastName]
      .where((part) => part.trim().isNotEmpty)
      .join(' ');
}

/// One medication line of a prescription.
class PrescriptionItem {
  final String id;
  final String medicationName;
  final String? dosage;
  final String? frequency;
  final String? duration;
  final int? quantity;
  final String? instructions;

  PrescriptionItem({
    required this.id,
    required this.medicationName,
    this.dosage,
    this.frequency,
    this.duration,
    this.quantity,
    this.instructions,
  });

  factory PrescriptionItem.fromJson(Map<String, dynamic> json) {
    return PrescriptionItem(
      id: parseString(json['id']) ?? '',
      medicationName:
          parseString(json['medication_name']) ?? 'Unknown medication',
      dosage: parseString(json['dosage']),
      frequency: parseString(json['frequency']),
      duration: parseString(json['duration']),
      quantity: parseInt(json['quantity']),
      instructions: parseString(json['instructions']),
    );
  }
}

/// Detailed prescription returned by `GET /api/v1/prescriptions/:id`.
///
/// The backend scopes this payload to the authenticated patient (ISSUED only)
/// or the owning doctor, so no doctor-only flags are exposed to patients.
class PrescriptionDetail {
  final String id;
  final String? prescriptionNumber;
  final DateTime? prescriptionDate;
  final DateTime? visitDate;
  final String? reasonForVisit;
  final String? diagnosis;
  final String? notes;
  final String? status;
  final bool hasPdf;
  final String? replacesPrescriptionNumber;

  final String patientFirstName;
  final String patientMiddleName;
  final String patientLastName;
  final DateTime? dateOfBirth;
  final String? sex;

  final String doctorFirstName;
  final String doctorMiddleName;
  final String doctorLastName;
  final String? doctorSpecialty;
  final String? doctorCredentials;
  final String? prcLicenseNumber;
  final String? practiceName;
  final String? practiceAddress;
  final String? practicePhone;
  final String? roomNumber;
  final String? doctorProfessionalPhotoUrl;

  final List<PrescriptionItem> items;

  PrescriptionDetail({
    required this.id,
    this.prescriptionNumber,
    this.prescriptionDate,
    this.visitDate,
    this.reasonForVisit,
    this.diagnosis,
    this.notes,
    this.status,
    required this.hasPdf,
    this.replacesPrescriptionNumber,
    required this.patientFirstName,
    this.patientMiddleName = '',
    required this.patientLastName,
    this.dateOfBirth,
    this.sex,
    required this.doctorFirstName,
    this.doctorMiddleName = '',
    required this.doctorLastName,
    this.doctorSpecialty,
    this.doctorCredentials,
    this.prcLicenseNumber,
    this.practiceName,
    this.practiceAddress,
    this.practicePhone,
    this.roomNumber,
    this.doctorProfessionalPhotoUrl,
    required this.items,
  });

  factory PrescriptionDetail.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final items = rawItems is List
        ? rawItems
            .whereType<Map>()
            .map((item) => PrescriptionItem.fromJson(
                  Map<String, dynamic>.from(item),
                ))
            .toList()
        : <PrescriptionItem>[];

    return PrescriptionDetail(
      id: json['id'] as String,
      prescriptionNumber: parseString(json['prescription_number']),
      prescriptionDate: _parseDate(json['prescription_date']),
      visitDate: _parseDate(json['visit_date']),
      reasonForVisit: parseString(json['reason_for_visit']),
      diagnosis: parseString(json['diagnosis']),
      notes: parseString(json['notes']),
      status: parseString(json['status']),
      hasPdf: json['has_pdf'] == true ||
          json['has_pdf']?.toString().toLowerCase() == 'true',
      replacesPrescriptionNumber:
          parseString(json['replaces_prescription_number']),
      patientFirstName: json['patient_first_name'] as String? ?? '',
      patientMiddleName: json['patient_middle_name'] as String? ?? '',
      patientLastName: json['patient_last_name'] as String? ?? '',
      dateOfBirth: _parseDate(json['date_of_birth']),
      sex: parseString(json['sex']),
      doctorFirstName: json['doctor_first_name'] as String? ?? '',
      doctorMiddleName: json['doctor_middle_name'] as String? ?? '',
      doctorLastName: json['doctor_last_name'] as String? ?? '',
      doctorSpecialty: parseString(json['doctor_specialty']),
      doctorCredentials: parseString(json['doctor_credentials']),
      prcLicenseNumber: parseString(json['prc_license_number']),
      practiceName: parseString(json['practice_name']),
      practiceAddress: parseString(json['practice_address']),
      practicePhone: parseString(json['practice_phone']),
      roomNumber: parseString(json['room_number']),
      doctorProfessionalPhotoUrl:
          parseString(json['doctor_professional_photo_url']),
      items: items,
    );
  }

  String get patientFullName =>
      [patientFirstName, patientMiddleName, patientLastName]
          .where((part) => part.trim().isNotEmpty)
          .join(' ');

  String get doctorFullName =>
      [doctorFirstName, doctorMiddleName, doctorLastName]
          .where((part) => part.trim().isNotEmpty)
          .join(' ');

  /// Age in whole years derived from [dateOfBirth].
  int? get patientAge {
    final dob = dateOfBirth;
    if (dob == null) return null;
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      age -= 1;
    }
    return age >= 0 ? age : null;
  }

  String? get formattedSex {
    switch (sex) {
      case 'MALE':
        return 'Male';
      case 'FEMALE':
        return 'Female';
      case 'OTHER':
        return 'Other';
      case null:
      case '':
      case 'NOT_SPECIFIED':
        return null;
      default:
        return sex;
    }
  }
}

DateTime? _parseDate(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  if (text.isEmpty) return null;
  return DateTime.tryParse(text);
}
