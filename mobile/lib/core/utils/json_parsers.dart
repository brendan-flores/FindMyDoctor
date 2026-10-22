/// Safe parsing helpers for raw JSON values returned by the backend API.
///
/// The node-postgres driver delivers PostgreSQL `DECIMAL`/`NUMERIC` columns as
/// JavaScript strings (for example `consultation_fee` arrives as `"500.00"`),
/// so those fields are JSON strings on the client and must be parsed instead
/// of cast directly (`as num?` throws
/// `type 'String' is not a subtype of type 'num?' in type cast`).
///
/// Every helper returns `null` instead of throwing for `null`, empty strings
/// and values that cannot be parsed.
library;

/// Converts [value] into a [num] without throwing.
///
/// Accepts numbers and numeric strings. `null`, empty strings and values that
/// cannot be parsed return `null`.
num? parseNum(dynamic value) {
  if (value == null) return null;
  if (value is num) return value;
  if (value is String) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    return num.tryParse(trimmed);
  }
  return null;
}

/// Converts [value] into an [int] without throwing.
///
/// Accepts numbers and numeric strings. Fractional values are truncated.
/// `null`, empty strings and values that cannot be parsed return `null`.
int? parseInt(dynamic value) {
  final parsed = parseNum(value);
  if (parsed == null) return null;
  return parsed.toInt();
}

/// Converts [value] into a [String] without throwing.
///
/// `null` and empty (or whitespace-only) strings return `null`.
String? parseString(dynamic value) {
  if (value == null) return null;
  if (value is String) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
  return value.toString();
}
