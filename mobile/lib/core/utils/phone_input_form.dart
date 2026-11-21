/// Flutter form glue for the pure Philippine phone helpers in
/// `phone_input.dart`.
///
/// The parsing, formatting and validation rules stay in `phone_input.dart`.
/// This file only adapts them to [TextInputFormatter] and to the fixed `+63`
/// field prefix used by the patient forms.
library;

import 'package:flutter/services.dart';

import 'phone_input.dart';

/// Fixed, non-editable prefix shown in front of every patient mobile field.
const String phMobilePrefixText = '+63 ';

/// Warning shown when a stored value cannot be read as a mobile number.
const String storedMobileWarning =
    'This saved number is not a recognized Philippine mobile number. Please re-enter it.';

/// Text input formatter backed by [formatPhoneInput].
///
/// Rejected input keeps the previous field value and reports the structured
/// error so the form can show an inline message instead of silently ignoring
/// the keystroke.
class PhilippineMobileInputFormatter extends TextInputFormatter {
  PhilippineMobileInputFormatter({required this.onRejected});

  /// Called with the reason the new value was rejected.
  final void Function(PhoneFormatError error) onRejected;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    // A complete, recognized number is normalized immediately: the field shows
    // a fixed `+63` prefix, so its value must hold only the 10-digit national
    // mobile portion. Parsing first (before the typing-oriented formatter) is
    // what lets a complete country-code-only value, such as `639171234567`,
    // normalize even though it is longer than a domestic value.
    final parsed = parsePhone(newValue.text);
    if (parsed.ok) {
      if (parsed.kind == PhoneKind.mobile && parsed.e164 != null) {
        final national = parsed.e164!.substring(phCountryCode.length + 1);
        return _apply(national, newValue);
      }
      // The parser read a complete landline. These patient fields accept
      // mobiles only, but an allocated `08` mobile is indistinguishable from a
      // landline until its final digit arrives: `817123456` is a national
      // landline yet becomes `8171234567`, and `0817123456` is a domestic
      // landline yet becomes `08171234567`. Keep the field building while one
      // more digit can still complete a valid mobile; otherwise refuse the
      // completed landline outright.
      if (!_canCompleteMobile(newValue.text)) {
        onRejected(PhoneFormatError.invalidPrefix);
        return oldValue;
      }
    }

    // Still being typed, or an extendable landline: defer to the Stage 1
    // formatter for partial input, including its corruption, malformed-plus,
    // and overlong rejections.
    final result = formatPhoneInput(newValue.text, oldValue.text);
    if (!result.ok) {
      onRejected(result.error!);
      return oldValue;
    }
    return _apply(result.value, newValue);
  }

  TextEditingValue _apply(String text, TextEditingValue newValue) {
    if (text == newValue.text) return newValue;
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }

  /// True when [raw] — which the Stage 1 parser already read as a complete
  /// landline — could still become a valid mobile by adding one more digit.
  ///
  /// The `08` allocation rules live in the Stage 1 parser, so this asks the
  /// parser itself whether any next digit completes a mobile instead of
  /// re-encoding the prefix list here.
  bool _canCompleteMobile(String raw) {
    for (var digit = 0; digit <= 9; digit++) {
      final extended = parsePhone('$raw$digit');
      if (extended.ok && extended.kind == PhoneKind.mobile) return true;
    }
    return false;
  }
}

/// Human-readable message for a formatter rejection.
String phoneFormatErrorMessage(PhoneFormatError error) {
  switch (error) {
    case PhoneFormatError.corrupted:
      return 'This phone number could not be understood. Please re-enter it.';
    case PhoneFormatError.malformedPlus:
      return 'Remove the extra plus sign and enter digits only.';
    case PhoneFormatError.invalidCharacters:
      return 'Use digits only for the mobile number.';
    case PhoneFormatError.tooLong:
      return 'This mobile number is too long.';
    case PhoneFormatError.invalidPrefix:
      return 'Enter a valid Philippine mobile number.';
  }
}

/// Human-readable message for a failed complete-value parse.
String phoneParseErrorMessage(PhoneParseError error) {
  switch (error) {
    case PhoneParseError.empty:
      return 'Mobile number is required';
    case PhoneParseError.corrupted:
      return 'This phone number could not be understood. Please re-enter it.';
    case PhoneParseError.malformedPlus:
      return 'Remove the plus sign and country code; enter the 10-digit mobile number.';
    case PhoneParseError.invalidCharacters:
      return 'Use digits only for the mobile number.';
    case PhoneParseError.tooLong:
      return 'This mobile number is too long.';
    case PhoneParseError.invalidPrefix:
    case PhoneParseError.invalidLength:
      return 'Enter a valid Philippine mobile number.';
  }
}

/// Validates a field value as a supported Philippine mobile number.
String? validatePhilippineMobile(String? raw) {
  final result = parsePhone(raw ?? '');
  if (!result.ok) return phoneParseErrorMessage(result.error!);
  if (result.kind != PhoneKind.mobile) {
    return 'Enter a valid Philippine mobile number.';
  }
  return null;
}

/// Canonical `+63` value submitted to the API, or null when [raw] is not a
/// supported Philippine mobile number.
String? canonicalMobileE164(String? raw) {
  final result = parsePhone(raw ?? '');
  if (!result.ok || result.kind != PhoneKind.mobile || result.e164 == null) {
    return null;
  }
  return result.e164;
}

/// Value to place in a fixed-`+63` field when loading a stored phone number.
///
/// Recognized mobile numbers are normalised to the 10-digit national form so
/// the field reads `+63 9171234567`. Unrecognized values are preserved exactly
/// as stored so the user can see what needs correcting.
String phoneFieldValueFromStored(String? raw) {
  final trimmed = raw?.trim() ?? '';
  if (trimmed.isEmpty) return '';
  final result = parsePhone(trimmed);
  if (result.ok && result.kind == PhoneKind.mobile && result.e164 != null) {
    return result.e164!.substring(phCountryCode.length + 1);
  }
  return trimmed;
}

/// Warning to show for a stored phone value that cannot be used as a mobile
/// number, or null when the value is valid or empty.
String? storedMobileWarningFor(String? raw) {
  final trimmed = raw?.trim() ?? '';
  if (trimmed.isEmpty) return null;
  final result = parsePhone(trimmed);
  if (result.ok && result.kind == PhoneKind.mobile) return null;
  return storedMobileWarning;
}
