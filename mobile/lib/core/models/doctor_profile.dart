/// Patient-facing doctor profile returned by the patient-only backend
/// endpoint. The model intentionally contains only the whitelisted public
/// professional fields; private contact details, license numbers, and account
/// status are never parsed because the API never returns them.
class DoctorProfile {
  final String id;
  final String displayName;
  final String? photoUrl;
  final String? specialty;
  final String? credentials;
  final String? practiceName;
  final String? practiceAddress;
  final String? roomNumber;
  final int? yearsOfExperience;
  final double? consultationFee;
  final List<String> areasOfExpertise;
  final List<String> languagesSpoken;
  final String? biography;
  final DoctorAvailability availability;

  const DoctorProfile({
    required this.id,
    required this.displayName,
    this.photoUrl,
    this.specialty,
    this.credentials,
    this.practiceName,
    this.practiceAddress,
    this.roomNumber,
    this.yearsOfExperience,
    this.consultationFee,
    this.areasOfExpertise = const [],
    this.languagesSpoken = const [],
    this.biography,
    required this.availability,
  });

  factory DoctorProfile.fromJson(Map<String, dynamic> json) {
    final rawAvailability = json['availability'];
    return DoctorProfile(
      id: json['id']?.toString() ?? '',
      displayName: _asString(json['displayName']) ?? '',
      photoUrl: _asString(json['photoUrl']),
      specialty: _asString(json['specialty']),
      credentials: _asString(json['credentials']),
      practiceName: _asString(json['practiceName']),
      practiceAddress: _asString(json['practiceAddress']),
      roomNumber: _asString(json['roomNumber']),
      yearsOfExperience: _asInt(json['yearsOfExperience']),
      consultationFee: _asDouble(json['consultationFee']),
      areasOfExpertise: _asStringList(json['areasOfExpertise']),
      languagesSpoken: _asStringList(json['languagesSpoken']),
      biography: _asString(json['biography']),
      availability: DoctorAvailability.fromJson(
        rawAvailability is Map
            ? Map<String, dynamic>.from(rawAvailability)
            : const {},
      ),
    );
  }
}

class DoctorAvailability {
  final bool availableToday;
  final int slotsLeftToday;
  final String? nextAvailableDate;
  final int consultationDurationMinutes;
  final List<DoctorWorkingDay> workingDays;

  const DoctorAvailability({
    required this.availableToday,
    required this.slotsLeftToday,
    this.nextAvailableDate,
    required this.consultationDurationMinutes,
    this.workingDays = const [],
  });

  factory DoctorAvailability.fromJson(Map<String, dynamic> json) {
    final rawDays = json['workingDays'];
    return DoctorAvailability(
      availableToday: json['availableToday'] == true,
      slotsLeftToday: _asInt(json['slotsLeftToday']) ?? 0,
      nextAvailableDate: _asString(json['nextAvailableDate']),
      consultationDurationMinutes:
          _asInt(json['consultationDurationMinutes']) ?? 0,
      workingDays: rawDays is List
          ? rawDays
                .whereType<Map>()
                .map(
                  (item) => DoctorWorkingDay.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList()
          : const [],
    );
  }
}

class DoctorWorkingDay {
  final int dayOfWeek;
  final String dayName;
  final String startTime;
  final String endTime;

  const DoctorWorkingDay({
    required this.dayOfWeek,
    required this.dayName,
    required this.startTime,
    required this.endTime,
  });

  factory DoctorWorkingDay.fromJson(Map<String, dynamic> json) {
    return DoctorWorkingDay(
      dayOfWeek: _asInt(json['dayOfWeek']) ?? 0,
      dayName: _asString(json['dayName']) ?? '',
      startTime: _asString(json['startTime']) ?? '',
      endTime: _asString(json['endTime']) ?? '',
    );
  }
}

String? _asString(dynamic value) {
  if (value == null) return null;
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

int? _asInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.round();
  return int.tryParse(value.toString());
}

double? _asDouble(dynamic value) {
  if (value == null) return null;
  if (value is double) return value;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

List<String> _asStringList(dynamic value) {
  if (value is List) {
    return value
        .map((item) => item?.toString().trim() ?? '')
        .where((item) => item.isNotEmpty)
        .toList();
  }
  if (value is String) {
    return value
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
  return const [];
}
