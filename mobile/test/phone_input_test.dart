import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/utils/phone_input.dart';
import 'package:mobile/core/utils/phone_input_form.dart';

void main() {
  // -------------------------------------------------------------------------
  // Parser: 09 mobile
  // -------------------------------------------------------------------------

  test('parsePhone accepts 09 domestic mobile numbers', () {
    final result = parsePhone('09171234567');
    expect(result.ok, isTrue);
    expect(result.kind, PhoneKind.mobile);
    expect(result.e164, '+639171234567');
    expect(result.national, '09171234567');
  });

  test('parsePhone accepts 09 national and +63 international mobile forms', () {
    final national = parsePhone('9171234567');
    expect(national.ok, isTrue);
    expect(national.kind, PhoneKind.mobile);
    expect(national.e164, '+639171234567');
    expect(national.national, '09171234567');

    final international = parsePhone('+639171234567');
    expect(international.ok, isTrue);
    expect(international.e164, '+639171234567');
    expect(international.national, '09171234567');
  });

  test('parsePhone accepts international digits without a leading plus', () {
    final result = parsePhone('639171234567');
    expect(result.ok, isTrue);
    expect(result.kind, PhoneKind.mobile);
    expect(result.e164, '+639171234567');
    expect(result.national, '09171234567');
  });

  test('parsePhone accepts structurally valid numbers whose digits repeat', () {
    final allNines = parsePhone('9999999999');
    expect(allNines.ok, isTrue);
    expect(allNines.kind, PhoneKind.mobile);
    expect(allNines.e164, '+639999999999');
    expect(allNines.national, '09999999999');

    final allOnes = parsePhone('09111111111');
    expect(allOnes.ok, isTrue);
    expect(allOnes.kind, PhoneKind.mobile);
    expect(allOnes.e164, '+639111111111');
    expect(allOnes.national, '09111111111');

    final allEights = parsePhone('09888888888');
    expect(allEights.ok, isTrue);
    expect(allEights.kind, PhoneKind.mobile);
    expect(allEights.e164, '+639888888888');
    expect(allEights.national, '09888888888');

    final landline = parsePhone('0211111111');
    expect(landline.ok, isTrue);
    expect(landline.kind, PhoneKind.landline);
    expect(landline.e164, '+63211111111');
    expect(landline.national, '0211111111');
  });

  // -------------------------------------------------------------------------
  // Parser: allocated 08 mobile prefixes
  // -------------------------------------------------------------------------

  test('parsePhone accepts exactly the six allocated 08 mobile prefixes', () {
    const cases = <String, String>{
      '08131234567': '+638131234567',
      '08171234567': '+638171234567',
      '08951234567': '+638951234567',
      '08961234567': '+638961234567',
      '08971234567': '+638971234567',
      '08981234567': '+638981234567',
    };

    cases.forEach((domestic, e164) {
      final result = parsePhone(domestic);
      expect(result.ok, isTrue, reason: '$domestic should parse');
      expect(result.kind, PhoneKind.mobile);
      expect(result.e164, e164);
      expect(result.national, domestic);
    });
  });

  test('parsePhone rejects unallocated 08 mobile prefixes', () {
    for (final value in [
      '08111234567',
      '08121234567',
      '08141234567',
      '08151234567',
      '08161234567',
      '08181234567',
      '08191234567',
      '08901234567',
      '08911234567',
      '08921234567',
      '08931234567',
      '08941234567',
      '08991234567',
    ]) {
      expect(
        parsePhone(value).error,
        PhoneParseError.invalidPrefix,
        reason: value,
      );
    }
  });

  test('parsePhone keeps 08 national, domestic and +63 forms consistent', () {
    // 0817 -> national 817XXXXXXX, domestic 0817XXXXXXX, +63817XXXXXXX
    for (final value in ['8171234567', '08171234567', '+638171234567']) {
      final result = parsePhone(value);
      expect(result.ok, isTrue, reason: value);
      expect(result.kind, PhoneKind.mobile);
      expect(result.e164, '+638171234567');
      expect(result.national, '08171234567');
    }
  });

  test('parsePhone accepts allocated 08 international digits without a leading plus',
      () {
    const cases = <String, String>{
      '638131234567': '+638131234567',
      '638171234567': '+638171234567',
      '638951234567': '+638951234567',
      '638961234567': '+638961234567',
      '638971234567': '+638971234567',
      '638981234567': '+638981234567',
    };

    cases.forEach((digitsOnly, e164) {
      final result = parsePhone(digitsOnly);
      expect(result.ok, isTrue, reason: '$digitsOnly should parse');
      expect(result.kind, PhoneKind.mobile);
      expect(result.e164, e164);
      expect(result.national, '0${digitsOnly.substring(2)}');
    });
  });

  test('parsePhone rejects an unallocated 08 prefix in +63 form too', () {
    expect(parsePhone('+638121234567').error, PhoneParseError.invalidPrefix);
  });

  // -------------------------------------------------------------------------
  // Parser: landlines
  // -------------------------------------------------------------------------

  test('parsePhone accepts 02 Manila landlines', () {
    final result = parsePhone('0281234567');
    expect(result.ok, isTrue);
    expect(result.kind, PhoneKind.landline);
    expect(result.e164, '+63281234567');
    expect(result.national, '0281234567');
  });

  test('parsePhone accepts the nine-digit national landline form', () {
    final result = parsePhone('821234567');
    expect(result.ok, isTrue);
    expect(result.kind, PhoneKind.landline);
    expect(result.e164, '+63821234567');
    expect(result.national, '0821234567');
  });

  test('parsePhone accepts landline area codes across the full 2 through 8 range',
      () {
    for (final areaCode in ['2', '3', '4', '5', '6', '7', '8']) {
      final domestic = '0${areaCode}812345678'.substring(0, 10);
      final result = parsePhone(domestic);
      expect(result.ok, isTrue, reason: '$domestic should parse');
      expect(result.kind, PhoneKind.landline);
      expect(result.national, domestic);
      expect(result.e164, '+63${domestic.substring(1)}');
    }
  });

  test('parsePhone accepts +63 international landlines', () {
    final result = parsePhone('+63281234567');
    expect(result.ok, isTrue);
    expect(result.kind, PhoneKind.landline);
    expect(result.national, '0281234567');
  });

  test('parsePhone rejects landline area codes outside 2 through 8', () {
    expect(parsePhone('0181234567').error, PhoneParseError.invalidPrefix);
    expect(parsePhone('0191234567').error, PhoneParseError.invalidPrefix);
  });

  test('parsePhone keeps nine-digit landlines distinct from ten-digit mobiles',
      () {
    // 821234567 is a nine-digit landline; 8212345678 is neither a landline nor
    // an allocated 08 mobile.
    final landline = parsePhone('821234567');
    expect(landline.ok, isTrue);
    expect(landline.kind, PhoneKind.landline);

    expect(parsePhone('8212345678').error, PhoneParseError.invalidPrefix);
  });

  // -------------------------------------------------------------------------
  // Parser: formatting separators, including periods
  // -------------------------------------------------------------------------

  test('parsePhone accepts periods as formatting separators', () {
    final result = parsePhone('0917.123.4567');
    expect(result.ok, isTrue);
    expect(result.e164, '+639171234567');
    expect(result.national, '09171234567');
  });

  test('parsePhone accepts spaces, hyphens, parentheses and periods together',
      () {
    for (final value in [
      '0917 123 4567',
      '0917-123-4567',
      '(0917) 123-4567',
      '0917.123.4567',
    ]) {
      final result = parsePhone(value);
      expect(result.ok, isTrue, reason: '$value should parse');
      expect(result.e164, '+639171234567');
    }
  });

  test('parsePhone never repairs scientific notation into a valid number', () {
    expect(parsePhone('9.17123E+10').error, PhoneParseError.corrupted);
    expect(parsePhone('9.17123457e10').error, PhoneParseError.corrupted);
    expect(parsePhone('917.1234567E10').error, PhoneParseError.corrupted);
  });

  // -------------------------------------------------------------------------
  // Parser: malformed plus
  // -------------------------------------------------------------------------

  test('parsePhone rejects a doubled plus sign', () {
    expect(parsePhone('++639171234567').error, PhoneParseError.malformedPlus);
  });

  test('parsePhone rejects a plus sign that is not leading', () {
    expect(parsePhone('63+9171234567').error, PhoneParseError.malformedPlus);
    expect(parsePhone('0917+1234567').error, PhoneParseError.malformedPlus);
  });

  test('parsePhone rejects a national number wearing a leading plus', () {
    expect(parsePhone('+09171234567').error, PhoneParseError.malformedPlus);
    expect(parsePhone('+0281234567').error, PhoneParseError.malformedPlus);
  });

  test('hasMalformedPlus only flags genuinely malformed plus signs', () {
    expect(hasMalformedPlus('09171234567'), isFalse);
    expect(hasMalformedPlus('+639171234567'), isFalse);
    expect(hasMalformedPlus('++639171234567'), isTrue);
    expect(hasMalformedPlus('63+9171234567'), isTrue);
  });

  // -------------------------------------------------------------------------
  // Parser: corrupted values
  // -------------------------------------------------------------------------

  test('parsePhone rejects the 00 international dialling prefix', () {
    expect(parsePhone('00639171234567').error, PhoneParseError.corrupted);
  });

  test('parsePhone rejects duplicated country-code and trunk prefixes', () {
    for (final value in [
      '+6309171234567',
      '6309171234567',
      '+63639171234567',
      '63639171234567',
    ]) {
      expect(
        parsePhone(value).error,
        PhoneParseError.corrupted,
        reason: value,
      );
    }
  });

  test('isCorruptedValue leaves legitimate formatted numbers alone', () {
    expect(isCorruptedValue('09171234567'), isFalse);
    expect(isCorruptedValue('+639171234567'), isFalse);
    expect(isCorruptedValue('639171234567'), isFalse);
    expect(isCorruptedValue('0281234567'), isFalse);
    expect(isCorruptedValue('0917.123.4567'), isFalse);
    expect(isCorruptedValue('09111111111'), isFalse);
    expect(isCorruptedValue('9999999999'), isFalse);
    expect(isCorruptedValue(''), isFalse);
  });

  test('isCorruptedValue flags duplicated prefixes, scientific notation and 00 dialling',
      () {
    expect(isCorruptedValue('+6309171234567'), isTrue);
    expect(isCorruptedValue('6309171234567'), isTrue);
    expect(isCorruptedValue('+63639171234567'), isTrue);
    expect(isCorruptedValue('63639171234567'), isTrue);
    expect(isCorruptedValue('9.17123E+10'), isTrue);
    expect(isCorruptedValue('00639171234567'), isTrue);
  });

  // -------------------------------------------------------------------------
  // Parser: length and character failures
  // -------------------------------------------------------------------------

  test('parsePhone rejects overlong input instead of truncating it', () {
    expect(parsePhone('091712345678').error, PhoneParseError.tooLong);
    expect(parsePhone('+6391712345678').error, PhoneParseError.tooLong);
  });

  test('parsePhone rejects numbers of an impossible length', () {
    expect(parsePhone('091712345').error, PhoneParseError.invalidLength);
    expect(parsePhone('028123456').error, PhoneParseError.invalidLength);
  });

  test('parsePhone rejects a truncated mobile as an invalid prefix', () {
    // Nine digits is a landline length, and 9 is not a landline area code.
    expect(parsePhone('0917123456').error, PhoneParseError.invalidPrefix);
  });

  test('parsePhone rejects non-numeric characters', () {
    expect(parsePhone('0917abc4567').error, PhoneParseError.invalidCharacters);
    expect(
      parsePhone('+63 917 123 456x').error,
      PhoneParseError.invalidCharacters,
    );
  });

  test('parsePhone rejects empty input', () {
    expect(parsePhone('').error, PhoneParseError.empty);
    expect(parsePhone('   ').error, PhoneParseError.empty);
  });

  test('parsePhone rejects numbers that do not start with 0, a valid prefix, or +63',
      () {
    expect(parsePhone('4171234567').error, PhoneParseError.invalidPrefix);
    expect(parsePhone('+659171234567').error, PhoneParseError.invalidPrefix);
  });

  // -------------------------------------------------------------------------
  // Formatter: permissible partial input
  // -------------------------------------------------------------------------

  test('formatPhoneInput accepts partial 09 mobile input while typing', () {
    for (final value in ['0', '09', '091', '0917', '0917123', '09171234567']) {
      final result = formatPhoneInput(value, '');
      expect(result.value, value);
      expect(result.error, isNull);
    }
  });

  test('formatPhoneInput accepts partial allocated 08 input while typing', () {
    for (final value in [
      '08',
      '081',
      '0813',
      '0817',
      '0895',
      '0898',
      '08981234567',
    ]) {
      final result = formatPhoneInput(value, '');
      expect(result.value, value);
      expect(result.error, isNull);
    }
  });

  test('formatPhoneInput allows an unallocated 08 prefix while it could still be a landline',
      () {
    // `0812` is not an allocated mobile block, but it is still a valid landline
    // prefix in progress, so typing it must not be blocked.
    final result = formatPhoneInput('0812', '081');
    expect(result.value, '0812');
    expect(result.error, isNull);
  });

  test('formatPhoneInput rejects an unallocated 08 prefix once it is a full mobile length',
      () {
    final result = formatPhoneInput('08121234567', '0812123456');
    expect(result.value, '0812123456');
    expect(result.error, PhoneFormatError.invalidPrefix);
  });

  test('formatPhoneInput accepts partial landline input while typing', () {
    for (final value in ['02', '028', '0281234567', '82', '821', '821234567']) {
      final result = formatPhoneInput(value, '');
      expect(result.value, value);
      expect(result.error, isNull);
    }
  });

  test('formatPhoneInput accepts partial international input while typing', () {
    for (final value in ['+', '+6', '+63', '+639', '+639171234567']) {
      final result = formatPhoneInput(value, '');
      expect(result.value, value);
      expect(result.error, isNull);
    }
  });

  test('formatPhoneInput strips separators, including periods, as the user types',
      () {
    expect(formatPhoneInput('0917-123', '').value, '0917123');

    final periods = formatPhoneInput('0917.123.4567', '');
    expect(periods.value, '09171234567');
    expect(periods.error, isNull);

    final mixed = formatPhoneInput('(0917) 123 4567', '');
    expect(mixed.value, '09171234567');
    expect(mixed.error, isNull);
  });

  test('formatPhoneInput clears the field when the user empties it', () {
    final result = formatPhoneInput('', '0917');
    expect(result.value, '');
    expect(result.error, isNull);
  });

  // -------------------------------------------------------------------------
  // Formatter: rejection preserves the previous value
  // -------------------------------------------------------------------------

  test('formatPhoneInput rejects overlong input and keeps the previous value',
      () {
    final national = formatPhoneInput('091712345678', '09171234567');
    expect(national.value, '09171234567');
    expect(national.error, PhoneFormatError.tooLong);

    final international = formatPhoneInput('+6391712345678', '+639171234567');
    expect(international.value, '+639171234567');
    expect(international.error, PhoneFormatError.tooLong);
  });

  test('formatPhoneInput rejects corrupted input and keeps the previous value',
      () {
    final scientific = formatPhoneInput('9.17123E+10', '0917');
    expect(scientific.value, '0917');
    expect(scientific.error, PhoneFormatError.corrupted);

    final diallingPrefix = formatPhoneInput('00639171234567', '0917');
    expect(diallingPrefix.value, '0917');
    expect(diallingPrefix.error, PhoneFormatError.corrupted);
  });

  test('formatPhoneInput rejects malformed plus signs and keeps the previous value',
      () {
    final doubled = formatPhoneInput('++63', '09');
    expect(doubled.value, '09');
    expect(doubled.error, PhoneFormatError.malformedPlus);

    final trailing = formatPhoneInput('63+9', '09');
    expect(trailing.value, '09');
    expect(trailing.error, PhoneFormatError.malformedPlus);

    final nationalWithPlus = formatPhoneInput('+0917', '09');
    expect(nationalWithPlus.value, '09');
    expect(nationalWithPlus.error, PhoneFormatError.malformedPlus);
  });

  test('formatPhoneInput rejects impossible prefixes and keeps the previous value',
      () {
    final trunkOne = formatPhoneInput('01', '');
    expect(trunkOne.value, '');
    expect(trunkOne.error, PhoneFormatError.invalidPrefix);

    // `417` could still become a landline (area code 4), so it is allowed while
    // typing; twelve digits is past every valid length and is rejected.
    final overlong = formatPhoneInput('417123456789', '4171234567');
    expect(overlong.value, '4171234567');
    expect(overlong.error, PhoneFormatError.tooLong);

    final wrongCountry = formatPhoneInput('+65', '');
    expect(wrongCountry.value, '');
    expect(wrongCountry.error, PhoneFormatError.invalidPrefix);
  });

  test('formatPhoneInput rejects non-numeric characters and keeps the previous value',
      () {
    final result = formatPhoneInput('0917a', '0917');
    expect(result.value, '0917');
    expect(result.error, PhoneFormatError.invalidCharacters);
  });

  test('formatPhoneInput never truncates an overlong value into a valid one',
      () {
    // 12 digits would become a valid 11-digit number if truncated; it must not.
    final result = formatPhoneInput('091712345670', '');
    expect(result.error, PhoneFormatError.tooLong);
    expect(result.value, '');
  });

  test('formatPhoneInput checks corruption before filtering incomplete digits',
      () {
    final result = formatPhoneInput('9.17123E+10', '0917');
    expect(result.error, PhoneFormatError.corrupted);
  });

  test('formatPhoneInput checks malformed plus before filtering incomplete digits',
      () {
    final result = formatPhoneInput('+63+', '+63');
    expect(result.error, PhoneFormatError.malformedPlus);
    expect(result.value, '+63');
  });

  // -------------------------------------------------------------------------
  // Patient mobile adapter: progressive typing through the formatter
  // -------------------------------------------------------------------------

  group('PhilippineMobileInputFormatter progressive mobile typing', () {
    /// Types [full] one character at a time through the adapter, always
    /// appending the next character to the value the field currently shows, and
    /// records the field value after every keystroke.
    ({List<String> values, List<PhoneFormatError> rejections}) type(String full) {
      final rejections = <PhoneFormatError>[];
      final formatter = PhilippineMobileInputFormatter(
        onRejected: rejections.add,
      );
      var current = '';
      final values = <String>[current];
      for (var i = 0; i < full.length; i++) {
        final next = '$current${full[i]}';
        final result = formatter.formatEditUpdate(
          TextEditingValue(
            text: current,
            selection: TextSelection.collapsed(offset: current.length),
          ),
          TextEditingValue(
            text: next,
            selection: TextSelection.collapsed(offset: next.length),
          ),
        );
        current = result.text;
        values.add(current);
      }
      return (values: values, rejections: rejections);
    }

    TextEditingValue edit(String text) => TextEditingValue(
          text: text,
          selection: TextSelection.collapsed(offset: text.length),
        );

    test('typing 8171234567 keeps every intermediate value and ends normalized',
        () {
      final result = type('8171234567');

      expect(result.values, [
        '',
        '8',
        '81',
        '817',
        '8171',
        '81712',
        '817123',
        '8171234',
        '81712345',
        '817123456',
        '8171234567',
      ]);
      expect(result.rejections, isEmpty);
    });

    test('typing 08171234567 keeps building and ends normalized to 8171234567',
        () {
      final result = type('08171234567');

      expect(result.values, [
        '',
        '0',
        '08',
        '081',
        '0817',
        '08171',
        '081712',
        '0817123',
        '08171234',
        '081712345',
        '0817123456',
        '8171234567',
      ]);
      expect(result.rejections, isEmpty);
    });

    test('typing every allocated 08 prefix ends normalized to ten digits', () {
      for (final prefix in const ['813', '817', '895', '896', '897', '898']) {
        final national = type('${prefix}1234567');
        expect(national.values.last, '${prefix}1234567', reason: prefix);
        expect(national.rejections, isEmpty, reason: prefix);

        final domestic = type('0${prefix}1234567');
        expect(domestic.values.last, '${prefix}1234567', reason: '0$prefix');
        expect(domestic.rejections, isEmpty, reason: '0$prefix');
      }
    });

    test('existing 09 mobile typing still ends normalized to ten digits', () {
      final national = type('9171234567');
      expect(national.values.last, '9171234567');
      expect(national.rejections, isEmpty);

      final domestic = type('09171234567');
      expect(domestic.values.last, '9171234567');
      expect(domestic.rejections, isEmpty);
    });

    test('a completed landline is still rejected in the patient field', () {
      for (final landline in const ['0281234567', '821234567', '0812123456']) {
        final rejections = <PhoneFormatError>[];
        final formatter = PhilippineMobileInputFormatter(
          onRejected: rejections.add,
        );
        final result = formatter.formatEditUpdate(edit('028'), edit(landline));
        expect(result.text, '028', reason: landline);
        expect(rejections, [PhoneFormatError.invalidPrefix], reason: landline);
      }
    });

    test('paste normalization still collapses complete mobile formats', () {
      for (final (input, national) in const [
        ('09171234567', '9171234567'),
        ('08171234567', '8171234567'),
        ('+639171234567', '9171234567'),
        ('+638171234567', '8171234567'),
        ('639171234567', '9171234567'),
        ('638171234567', '8171234567'),
      ]) {
        final rejections = <PhoneFormatError>[];
        final formatter = PhilippineMobileInputFormatter(
          onRejected: rejections.add,
        );
        final result = formatter.formatEditUpdate(edit(''), edit(input));
        expect(result.text, national, reason: input);
        expect(rejections, isEmpty, reason: input);
      }
    });
  });
}
