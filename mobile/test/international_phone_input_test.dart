import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:phone_numbers_parser/phone_numbers_parser.dart';

import 'package:mobile/core/widgets/international_phone_input.dart';

void main() {
  group('InternationalPhoneInput', () {
    Future<void> pumpWidget(WidgetTester tester, {
      required IsoCode country,
      required String nationalNumber,
      bool allowLandline = false,
      bool requiredField = true,
      GlobalKey<InternationalPhoneInputState>? key,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: InternationalPhoneInput(
              key: key,
              country: country,
              nationalNumber: nationalNumber,
              onCountryChanged: (c) {},
              onNationalChanged: (n) {},
              allowLandline: allowLandline,
              labelText: 'Mobile Number',
              hintText: 'National number',
              requiredField: requiredField,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    TextField textField(WidgetTester tester) =>
        tester.widget<TextField>(
          find.descendant(
            of: find.byType(InternationalPhoneInput),
            matching: find.byType(TextField),
          ),
        );

    Finder textFieldFinder(WidgetTester tester) => find.descendant(
          of: find.byType(InternationalPhoneInput),
          matching: find.byType(TextField),
        );

    DropdownButton<IsoCode> dropdown(WidgetTester tester) =>
        tester.widget<DropdownButton<IsoCode>>(
          find.descendant(
            of: find.byType(InternationalPhoneInput),
            matching: find.byType(DropdownButton<IsoCode>),
          ),
        );

    testWidgets('defaults to Philippines as the selected country', (tester) async {
      await pumpWidget(tester, country: IsoCode.PH, nationalNumber: '');
      expect(dropdown(tester).value, IsoCode.PH);
    });

    testWidgets('shows country dropdown with all supported countries and calling codes',
        (tester) async {
      await pumpWidget(tester, country: IsoCode.PH, nationalNumber: '');
      final drop = dropdown(tester);
      expect(drop.items, isNotEmpty);
      expect(drop.items!.length, IsoCode.values.length);
      final phItem = drop.items!.firstWhere(
        (item) => item.value == IsoCode.PH,
      );
      expect((phItem.child as Text).data, contains('+63'));
    });

    testWidgets('accepts a Philippine mobile number and produces E.164',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        key: key,
      );
      await tester.enterText(textFieldFinder(tester), '9171234567');
      await tester.pump();

      final state = key.currentState;
      expect(state, isNotNull);
      expect(state!.e164, '+639171234567');
      expect(state.isValid, isTrue);
      expect(state.errorText, isNull);
    });

    testWidgets('accepts all six allocated Philippine 08 mobile prefixes',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        key: key,
      );

      for (final prefix in const ['813', '817', '895', '896', '897', '898']) {
        await tester.enterText(textFieldFinder(tester), '${prefix}1234567');
        await tester.pump();

        final state = key.currentState;
        expect(state!.e164, '+63${prefix}1234567', reason: prefix);
        expect(state.isValid, isTrue, reason: prefix);
        expect(state.errorText, isNull, reason: prefix);
      }
    });

    testWidgets('accepts Philippine domestic 09 form and normalizes to E.164',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        key: key,
      );
      await tester.enterText(textFieldFinder(tester), '09171234567');
      await tester.pump();

      final state = key.currentState;
      expect(state!.e164, '+639171234567');
      expect(state.isValid, isTrue);
    });

    testWidgets('rejects a Philippine landline when landlines are not allowed',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        key: key,
      );
      await tester.enterText(textFieldFinder(tester), '212345678');
      await tester.pump();

      final state = key.currentState;
      expect(state!.e164, isNull);
      expect(state.isValid, isFalse);
      expect(state.errorText, 'Enter a valid mobile number.');
    });

    testWidgets('rejects an unallocated Philippine 08 prefix',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        key: key,
      );
      await tester.enterText(textFieldFinder(tester), '8121234567');
      await tester.pump();

      final state = key.currentState;
      expect(state!.e164, isNull);
      expect(state.isValid, isFalse);
    });

    testWidgets('accepts a Philippine landline when allowLandline is true',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        allowLandline: true,
        key: key,
      );
      await tester.enterText(textFieldFinder(tester), '212345678');
      await tester.pump();

      final state = key.currentState;
      expect(state!.e164, '+63212345678');
      expect(state.isValid, isTrue);
      expect(state.errorText, isNull);
    });

    testWidgets('accepts an international mobile number with its own country',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.GB,
        nationalNumber: '',
        key: key,
      );
      await tester.enterText(textFieldFinder(tester), '7123456789');
      await tester.pump();

      final state = key.currentState;
      expect(state!.e164, '+447123456789');
      expect(state.isValid, isTrue);
      expect(state.errorText, isNull);
    });

    testWidgets('rejects an international fixed-line number',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.GB,
        nationalNumber: '',
        key: key,
      );
      await tester.enterText(textFieldFinder(tester), '2012345678');
      await tester.pump();

      final state = key.currentState;
      expect(state!.e164, isNull);
      expect(state.isValid, isFalse);
      expect(state.errorText, 'Enter a valid mobile number.');
    });

    testWidgets('rejects an ambiguous fixed-line-or-mobile number for mobile-only fields',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.US,
        nationalNumber: '',
        key: key,
      );
      await tester.enterText(textFieldFinder(tester), '4155550123');
      await tester.pump();

      final state = key.currentState;
      expect(state!.e164, isNull);
      expect(state.isValid, isFalse);
    });

    testWidgets('rejects invalid and incomplete numbers', (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        key: key,
      );

      await tester.enterText(textFieldFinder(tester), '91712345');
      await tester.pump();
      expect(key.currentState!.e164, isNull);
      expect(key.currentState!.isValid, isFalse);

      await tester.enterText(textFieldFinder(tester), 'abc');
      await tester.pump();
      expect(key.currentState!.e164, isNull);
      expect(key.currentState!.isValid, isFalse);
    });

    testWidgets('shows a required-field error when the number is empty',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        key: key,
      );

      final state = key.currentState;
      expect(state!.isValid, isFalse);
      expect(state.errorText, 'Mobile number is required');
    });

    testWidgets('pastes an international E.164 number and detects its country',
        (tester) async {
      final capturedCountry = <IsoCode>[];
      final capturedNational = <String>[];
      final key = GlobalKey<InternationalPhoneInputState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: InternationalPhoneInput(
              key: key,
              country: IsoCode.PH,
              nationalNumber: '',
              onCountryChanged: capturedCountry.add,
              onNationalChanged: capturedNational.add,
              allowLandline: false,
              labelText: 'Mobile Number',
              requiredField: true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final field = textField(tester);
      await tester.enterText(textFieldFinder(tester), '+447123456789');
      await tester.pump();

      expect(capturedCountry, [IsoCode.GB]);
      expect(capturedNational, ['7123456789']);
      expect(field.controller?.text, '7123456789');

      final state = key.currentState;
      expect(state!.e164, '+447123456789');
      expect(state.isValid, isTrue);
    });

    testWidgets('does not duplicate the country calling code when pasting E.164',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: InternationalPhoneInput(
              key: key,
              country: IsoCode.PH,
              nationalNumber: '',
              onCountryChanged: (c) {},
              onNationalChanged: (n) {},
              allowLandline: false,
              labelText: 'Mobile Number',
              requiredField: true,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final field = textField(tester);
      await tester.enterText(textFieldFinder(tester), '+639171234567');
      await tester.pump();

      final state = key.currentState;
      expect(state!.e164, '+639171234567');
      expect(field.controller?.text, '9171234567');
      expect(state.isValid, isTrue);
    });

    testWidgets('preserves national number when country changes',
        (tester) async {
      final key = GlobalKey<InternationalPhoneInputState>();
      await pumpWidget(
        tester,
        country: IsoCode.PH,
        nationalNumber: '',
        key: key,
      );

      await tester.enterText(textFieldFinder(tester), '9171234567');
      await tester.pump();
      expect(key.currentState!.e164, '+639171234567');

      await pumpWidget(
        tester,
        country: IsoCode.US,
        nationalNumber: '9171234567',
        key: key,
      );
      await tester.pumpAndSettle();

      expect(textField(tester).controller?.text, '9171234567');
      expect(key.currentState!.e164, isNull);
      expect(key.currentState!.errorText, isNotNull);
    });
  });
}
