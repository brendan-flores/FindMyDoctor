/// Philippine phone number parsing and input formatting.
///
/// Pure helpers only: no dependencies, no I/O, no Flutter imports. This is a
/// line-for-line mirror of `web/src/lib/phone.ts`; any behavioural change must
/// be made in both files in the same commit.
///
/// Accepted shapes
/// ---------------
/// Mobile, domestic (11 digits):
///   09XXXXXXXXX            -> +639XXXXXXXXX
///   0813XXXXXXX            -> +63813XXXXXXX
///   0817XXXXXXX            -> +63817XXXXXXX
///   0895XXXXXXX            -> +63895XXXXXXX
///   0896XXXXXXX            -> +63896XXXXXXX
///   0897XXXXXXX            -> +63897XXXXXXX
///   0898XXXXXXX            -> +63898XXXXXXX
/// Mobile, national (10 digits, no trunk zero):
///   9XXXXXXXXX / 813XXXXXXX / 817XXXXXXX / 895..898XXXXXXX
/// Mobile, international (with or without the leading plus):
///   +63 followed by either national form above, or the same digits without the
///   plus, e.g. `+639171234567` or `639171234567`.
///
/// Landline, domestic (10 digits):   0[2-8]XXXXXXXX  -> +63[2-8]XXXXXXXX
/// Landline, national (9 digits):    [2-8]XXXXXXXX   -> +63[2-8]XXXXXXXX
/// Landline, international:          +63[2-8]XXXXXXXX
///
/// Design rules
/// ------------
/// 1. A +63 international number may be written with or without the leading
///    plus, so `+639171234567` and `639171234567` both parse. A duplicated
///    country code or domestic trunk prefix (`+6309...`, `6363...`) is
///    corrupted, not silently repaired.
/// 2. `08` is a mobile prefix only for the allocated blocks 0813, 0817, 0895,
///    0896, 0897 and 0898. Every other `08` block is rejected rather than
///    accepted structurally, so an unallocated prefix cannot slip through.
/// 3. Landline area codes cover the full 2 through 8 range, so families such as
///    82 are valid. National landlines are nine digits; national mobiles are ten.
/// 4. Periods are formatting separators, so `0917.123.4567` is accepted and
///    normalised. Scientific notation is still detected and rejected before any
///    separator stripping, so it can never be silently repaired into a number.
/// 5. Overlong input is rejected, never truncated. Silently cutting digits off a
///    phone number produces a plausible-looking number that reaches the wrong
///    person.
/// 6. On rejection the formatter returns the caller's previous value unchanged
///    plus a structured error, so a form can keep the field stable and show an
///    inline message.
library;

/// Kind of Philippine number that was parsed.
enum PhoneKind { mobile, landline }

/// Reasons a complete value failed to parse.
enum PhoneParseError {
  empty,
  corrupted,
  malformedPlus,
  invalidCharacters,
  tooLong,
  invalidPrefix,
  invalidLength,
}

/// Reasons a formatter rejected an in-progress value.
enum PhoneFormatError {
  corrupted,
  malformedPlus,
  invalidCharacters,
  tooLong,
  invalidPrefix,
}

/// Result of parsing a complete phone number.
class PhoneParseResult {
  const PhoneParseResult._({
    required this.ok,
    this.kind,
    this.e164,
    this.national,
    this.error,
  });

  /// Successful parse.
  const PhoneParseResult.success({
    required PhoneKind kind,
    required String e164,
    required String national,
  }) : this._(ok: true, kind: kind, e164: e164, national: national);

  /// Failed parse.
  const PhoneParseResult.failure(PhoneParseError error)
      : this._(ok: false, error: error);

  /// Whether the value parsed.
  final bool ok;

  /// Number kind, set when [ok] is true.
  final PhoneKind? kind;

  /// Canonical E.164 form, e.g. `+639171234567`.
  final String? e164;

  /// Domestic form with the trunk zero, e.g. `09171234567`.
  final String? national;

  /// Failure reason, set when [ok] is false.
  final PhoneParseError? error;

  @override
  String toString() => ok
      ? 'PhoneParseResult.success($kind, $e164, $national)'
      : 'PhoneParseResult.failure($error)';
}

/// Result of formatting an in-progress phone value.
class PhoneFormatResult {
  const PhoneFormatResult({required this.value, this.error});

  /// The value the field should hold.
  final String value;

  /// Rejection reason, or `null` when the value was accepted.
  final PhoneFormatError? error;

  /// Whether the value was accepted.
  bool get ok => error == null;

  @override
  String toString() => 'PhoneFormatResult($value, $error)';
}

/// Philippine country calling code.
const String phCountryCode = '63';

/// National significant number of a mobile: 9XXXXXXXXX.
const int mobileNationalLength = 10;

/// Domestic mobile, trunk zero included: 09XXXXXXXXX.
const int mobileDomesticLength = 11;

/// National significant number of a landline: [2-8]XXXXXXXX.
const int landlineNationalLength = 9;

/// Domestic landline, trunk zero included: 0[2-8]XXXXXXXX.
const int landlineDomesticLength = 10;

/// Longest accepted domestic digit count (mobile).
const int maxNationalDigits = mobileDomesticLength;

/// Country code plus the longest national significant number (mobile).
const int maxInternationalDigits = 2 + mobileNationalLength;

/// Allocated `08` mobile blocks, in national form (trunk zero stripped).
/// Only these six are valid; the rest of the `08` range is unallocated.
const List<String> _mobile08NationalPrefixes = [
  '813',
  '817',
  '895',
  '896',
  '897',
  '898',
];

/// Landline area codes cover 2 through 8.
const String _landlineAreaCodeStart = '2345678';

/// Characters stripped before validation. Periods are included: they are a
/// legitimate formatting separator, not a corruption signal.
const String _separatorCharacters = ' \t\r\n-().';

bool _isLandlineAreaCodeStart(String char) =>
    _landlineAreaCodeStart.contains(char);

String _stripSeparators(String raw) {
  final buffer = StringBuffer();
  for (final rune in raw.trim().runes) {
    final char = String.fromCharCode(rune);
    if (!_separatorCharacters.contains(char)) buffer.write(char);
  }
  return buffer.toString();
}

/// True when the value carries the fingerprints of a mangled import: Excel
/// scientific notation, a `00` international dialling prefix, or a duplicated
/// country code / domestic trunk prefix.
///
/// Repeated digits are NOT corruption: `09111111111` and `9999999999` are
/// structurally valid Philippine numbers and are validated by prefix and length
/// instead. Periods are deliberately NOT a corruption signal here; they are
/// separators.
bool isCorruptedValue(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return false;

  // Excel turns long digit strings into 9.17123E+10 style values. Checked
  // before separator stripping so it can never be repaired into a number.
  if (trimmed.contains('e') || trimmed.contains('E')) return true;

  // `0063...` is an international dialling prefix, not a leading-plus number.
  if (trimmed.startsWith('00')) return true;

  final digits = _stripSeparators(trimmed).replaceFirst(RegExp(r'^\+'), '');
  return _hasDuplicatedInternationalPrefix(digits);
}

/// True when a country code has been duplicated: `+63` followed by a domestic
/// trunk zero (`+6309...`), or `63` repeated before a valid national number
/// (`6363...`). Matched precisely so genuine landlines in the 63x family still
/// parse.
bool _hasDuplicatedInternationalPrefix(String digits) {
  if (!digits.startsWith(phCountryCode)) return false;
  final national = digits.substring(phCountryCode.length);
  if (national.startsWith('0') &&
      _classifyNationalSignificant(national.substring(1)) != null) {
    return true;
  }
  return national.startsWith(phCountryCode) &&
      _classifyNationalSignificant(national.substring(phCountryCode.length)) !=
          null;
}

/// True when the plus sign is present but not a single leading plus.
/// A lone `+` is treated as an incomplete number, not a malformed one.
bool hasMalformedPlus(String raw) {
  final trimmed = raw.trim();
  final firstPlus = trimmed.indexOf('+');
  if (firstPlus == -1) return false;
  if (firstPlus != 0) return true;
  return trimmed.indexOf('+', 1) != -1;
}

/// Classifies a national significant number (trunk zero and country code
/// removed) as a mobile or landline, or null when it is not a valid length or
/// prefix.
PhoneKind? _classifyNationalSignificant(String ns) {
  if (ns.length == mobileNationalLength) {
    if (ns[0] == '9') return PhoneKind.mobile;
    if (_mobile08NationalPrefixes.contains(ns.substring(0, 3))) {
      return PhoneKind.mobile;
    }
    return null;
  }
  if (ns.length == landlineNationalLength) {
    if (_isLandlineAreaCodeStart(ns[0])) return PhoneKind.landline;
    return null;
  }
  return null;
}

/// True when [ns] could still grow into a valid mobile national number.
bool _isMobileNationalPrefix(String ns) {
  if (ns.length > mobileNationalLength) return false;
  if (ns[0] == '9') return true;
  if (ns[0] == '8') {
    final head = ns.substring(0, ns.length < 3 ? ns.length : 3);
    return _mobile08NationalPrefixes
        .any((prefix) => prefix.startsWith(head) || ns.startsWith(prefix));
  }
  return false;
}

/// True when [ns] could still grow into a valid landline national number.
bool _isLandlineNationalPrefix(String ns) {
  if (ns.length > landlineNationalLength) return false;
  return _isLandlineAreaCodeStart(ns[0]);
}

/// True when [ns] is a prefix of some valid national significant number.
bool _isPermissiblePartialSignificant(String ns) {
  if (ns.isEmpty) return true;
  if (_isMobileNationalPrefix(ns)) return true;
  if (_isLandlineNationalPrefix(ns)) return true;
  return false;
}

/// True when the digit string could still grow into a valid national number.
/// This is what lets a form accept `0`, `09`, `0917`, `821` while the user is
/// typing.
bool isPermissiblePartialNational(String digits) {
  if (digits.isEmpty) return true;
  if (digits.length > maxNationalDigits) return false;
  final ns = digits[0] == '0' ? digits.substring(1) : digits;
  return _isPermissiblePartialSignificant(ns);
}

/// True when the digit string (country code included, plus stripped) could still
/// grow into a valid international number.
bool isPermissiblePartialInternational(String digits) {
  if (digits.isEmpty) return true;
  if (digits.length > maxInternationalDigits) return false;
  if (digits[0] != '6') return false;
  if (digits.length == 1) return true;
  if (digits[1] != '3') return false;
  return _isPermissiblePartialSignificant(digits.substring(phCountryCode.length));
}

final RegExp _plusDigits = RegExp(r'^\+?\d+$');
final RegExp _optionalPlusDigits = RegExp(r'^\+?\d*$');

PhoneParseResult _buildResult(String ns) {
  final kind = _classifyNationalSignificant(ns);
  if (kind != null) {
    return PhoneParseResult.success(
      kind: kind,
      e164: '+$phCountryCode$ns',
      national: '0$ns',
    );
  }
  if (ns.length > mobileNationalLength) {
    return const PhoneParseResult.failure(PhoneParseError.tooLong);
  }
  if (ns.length < landlineNationalLength) {
    return const PhoneParseResult.failure(PhoneParseError.invalidLength);
  }
  return const PhoneParseResult.failure(PhoneParseError.invalidPrefix);
}

/// Parses a complete Philippine phone number into canonical form.
///
/// Incomplete input is a failure here: use [formatPhoneInput] while the user is
/// still typing.
PhoneParseResult parsePhone(String raw) {
  if (raw.trim().isEmpty) {
    return const PhoneParseResult.failure(PhoneParseError.empty);
  }

  if (isCorruptedValue(raw)) {
    return const PhoneParseResult.failure(PhoneParseError.corrupted);
  }
  if (hasMalformedPlus(raw)) {
    return const PhoneParseResult.failure(PhoneParseError.malformedPlus);
  }

  final stripped = _stripSeparators(raw);
  if (!_plusDigits.hasMatch(stripped)) {
    return const PhoneParseResult.failure(PhoneParseError.invalidCharacters);
  }

  final hasPlus = stripped.startsWith('+');
  final digits = hasPlus ? stripped.substring(1) : stripped;

  if (hasPlus) {
    if (digits.length > maxInternationalDigits) {
      return const PhoneParseResult.failure(PhoneParseError.tooLong);
    }
    // `+0917...` is a national number wearing a plus: the plus is malformed,
    // not the prefix.
    if (digits.startsWith('0')) {
      return const PhoneParseResult.failure(PhoneParseError.malformedPlus);
    }
    if (!digits.startsWith(phCountryCode)) {
      return const PhoneParseResult.failure(PhoneParseError.invalidPrefix);
    }

    final ns = digits.substring(phCountryCode.length);
    if (ns.isEmpty) {
      return const PhoneParseResult.failure(PhoneParseError.invalidLength);
    }
    return _buildResult(ns);
  }

  // Digits-only international form: the parser accepts `63` followed by a
  // complete national significant number without the leading plus.
  if (digits.startsWith(phCountryCode)) {
    final ns = digits.substring(phCountryCode.length);
    if (ns.length == landlineNationalLength ||
        ns.length == mobileNationalLength) {
      return _buildResult(ns);
    }
  }

  if (digits.length > maxNationalDigits) {
    return const PhoneParseResult.failure(PhoneParseError.tooLong);
  }

  final ns = digits.startsWith('0') ? digits.substring(1) : digits;
  if (ns.isEmpty) {
    return const PhoneParseResult.failure(PhoneParseError.invalidLength);
  }
  return _buildResult(ns);
}

/// Formats a partially typed phone number for a controlled text field.
///
/// Order is deliberate and must not be rearranged:
///   1. corruption check on the raw value,
///   2. malformed plus check,
///   3. character check after separator stripping,
///   4. overlong rejection (never truncate),
///   5. permissible-incomplete-digit filtering.
///
/// On any rejection the previous value is returned untouched with a structured
/// error, so the field stays stable and the caller can show an inline message.
PhoneFormatResult formatPhoneInput(String raw, String previous) {
  if (raw.trim().isEmpty) return const PhoneFormatResult(value: '');

  if (isCorruptedValue(raw)) {
    return PhoneFormatResult(value: previous, error: PhoneFormatError.corrupted);
  }
  if (hasMalformedPlus(raw)) {
    return PhoneFormatResult(
      value: previous,
      error: PhoneFormatError.malformedPlus,
    );
  }

  final stripped = _stripSeparators(raw);
  if (!_optionalPlusDigits.hasMatch(stripped)) {
    return PhoneFormatResult(
      value: previous,
      error: PhoneFormatError.invalidCharacters,
    );
  }

  final hasPlus = stripped.startsWith('+');
  final digits = hasPlus ? stripped.substring(1) : stripped;

  // A bare `+` is the first keystroke of an international number, not an error.
  if (hasPlus && digits.isEmpty) {
    return const PhoneFormatResult(value: '+');
  }

  final maxDigits = hasPlus ? maxInternationalDigits : maxNationalDigits;
  if (digits.length > maxDigits) {
    return PhoneFormatResult(value: previous, error: PhoneFormatError.tooLong);
  }

  if (hasPlus && digits.startsWith('0')) {
    return PhoneFormatResult(
      value: previous,
      error: PhoneFormatError.malformedPlus,
    );
  }

  final permissible = hasPlus
      ? isPermissiblePartialInternational(digits)
      : isPermissiblePartialNational(digits);
  if (!permissible) {
    return PhoneFormatResult(
      value: previous,
      error: PhoneFormatError.invalidPrefix,
    );
  }

  return PhoneFormatResult(value: '${hasPlus ? '+' : ''}$digits');
}
