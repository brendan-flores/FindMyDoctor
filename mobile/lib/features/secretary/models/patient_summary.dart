/// Read-only patient appointment-summary model used by the secretary
/// patient-info sheet. Mirrors the response of
/// `GET /api/v1/conversations/:id/appointment-summary`.
class PatientSummary {
  final PatientSummaryPatient patient;
  final PatientSummaryAppointment? appointment;
  final PatientSummaryDoctor doctor;

  const PatientSummary({
    required this.patient,
    required this.doctor,
    this.appointment,
  });

  factory PatientSummary.fromJson(Map<String, dynamic> json) {
    return PatientSummary(
      patient: PatientSummaryPatient.fromJson(
        _asMap(json['patient']),
      ),
      appointment: json['appointment'] is Map
          ? PatientSummaryAppointment.fromJson(
              _asMap(json['appointment']),
            )
          : null,
      doctor: PatientSummaryDoctor.fromJson(_asMap(json['doctor'])),
    );
  }

  static Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map) return Map<String, dynamic>.from(value);
    return const <String, dynamic>{};
  }
}

class PatientSummaryPatient {
  final String id;
  final String firstName;
  final String? middleName;
  final String lastName;
  final String? dateOfBirth;
  final String? phone;
  final String? email;

  const PatientSummaryPatient({
    required this.id,
    required this.firstName,
    required this.lastName,
    this.middleName,
    this.dateOfBirth,
    this.phone,
    this.email,
  });

  factory PatientSummaryPatient.fromJson(Map<String, dynamic> json) {
    return PatientSummaryPatient(
      id: (json['id'] ?? '').toString(),
      firstName: (json['firstName'] ?? '').toString(),
      middleName: _nullableString(json['middleName']),
      lastName: (json['lastName'] ?? '').toString(),
      dateOfBirth: _nullableString(json['dateOfBirth']),
      phone: _nullableString(json['phone']),
      email: _nullableString(json['email']),
    );
  }

  String get fullName {
    final parts = [firstName, middleName ?? '', lastName]
        .where((part) => part.trim().isNotEmpty)
        .toList();
    return parts.isEmpty ? 'Patient' : parts.join(' ');
  }

  DateTime? get dateOfBirthValue {
    if (dateOfBirth == null) return null;
    return DateTime.tryParse(dateOfBirth!);
  }
}

class PatientSummaryAppointment {
  final DateTime? appointmentDate;
  final String status;
  final String? reasonForVisit;
  final int? queueNumber;

  const PatientSummaryAppointment({
    required this.status,
    this.appointmentDate,
    this.reasonForVisit,
    this.queueNumber,
  });

  factory PatientSummaryAppointment.fromJson(Map<String, dynamic> json) {
    return PatientSummaryAppointment(
      appointmentDate: json['appointmentDate'] != null
          ? DateTime.tryParse(json['appointmentDate'].toString())
          : null,
      status: (json['status'] ?? '').toString(),
      reasonForVisit: _nullableString(json['reasonForVisit']),
      queueNumber: json['queueNumber'] != null
          ? int.tryParse(json['queueNumber'].toString())
          : null,
    );
  }
}

class PatientSummaryDoctor {
  final String firstName;
  final String lastName;
  final String? practiceName;

  const PatientSummaryDoctor({
    required this.firstName,
    required this.lastName,
    this.practiceName,
  });

  factory PatientSummaryDoctor.fromJson(Map<String, dynamic> json) {
    return PatientSummaryDoctor(
      firstName: (json['firstName'] ?? '').toString(),
      lastName: (json['lastName'] ?? '').toString(),
      practiceName: _nullableString(json['practiceName']),
    );
  }

  String get fullName {
    final name = '$firstName $lastName'.trim();
    return name.isEmpty ? 'Doctor' : name;
  }
}

String? _nullableString(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}
