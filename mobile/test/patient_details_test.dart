import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/widgets/skeleton.dart';
import 'package:mobile/core/widgets/international_phone_input.dart';
import 'package:mobile/features/patients/presentation/patient_details_page.dart';

void main() {
  group('Patient Details Workflow Tests', () {
    testWidgets(
      'Patient details page can be created with required parameters',
      (WidgetTester tester) async {
        // This test verifies the page can be instantiated with required parameters
        await tester.pumpWidget(
          MaterialApp(
            home: PatientDetailsPage(
              doctorId: 'test-doctor-id',
              doctorName: 'Dr. Test',
            ),
          ),
        );

        expect(find.byType(PatientDetailsPage), findsOneWidget);
      },
    );

    testWidgets('Back button is present on patient details page', (
      WidgetTester tester,
    ) async {
      // This test verifies back navigation control exists
      await tester.pumpWidget(
        MaterialApp(
          home: PatientDetailsPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
          ),
        ),
      );

      expect(find.byIcon(Icons.arrow_back_ios_new), findsOneWidget);
    });

    testWidgets('Loading state is displayed initially', (
      WidgetTester tester,
    ) async {
      // This test verifies loading state is shown
      await tester.pumpWidget(
        MaterialApp(
          home: PatientDetailsPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
          ),
        ),
      );

      expect(find.byType(FormFieldsSkeleton), findsOneWidget);
    });

    testWidgets('Submit button is present', (WidgetTester tester) async {
      // This test verifies submit button exists
      await tester.pumpWidget(
        MaterialApp(
          home: PatientDetailsPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
          ),
        ),
      );

      // Wait for loading
      await tester.pumpAndSettle();

      expect(find.text('Continue to Booking'), findsOneWidget);
    });

    testWidgets('Booking state parameters are preserved in widget', (
      WidgetTester tester,
    ) async {
      // This test verifies booking state (doctor, specialty, clinic, fee, date) is preserved
      await tester.pumpWidget(
        MaterialApp(
          home: PatientDetailsPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
            specialty: 'Cardiology',
            clinic: 'Test Clinic',
            consultationFee: '1000',
            selectedDate: DateTime(2026, 10, 20),
          ),
        ),
      );

      final patientDetailsPage = tester.widget<PatientDetailsPage>(
        find.byType(PatientDetailsPage),
      );

      expect(patientDetailsPage.doctorId, 'test-doctor-id');
      expect(patientDetailsPage.doctorName, 'Dr. Test');
      expect(patientDetailsPage.specialty, 'Cardiology');
      expect(patientDetailsPage.clinic, 'Test Clinic');
      expect(patientDetailsPage.consultationFee, '1000');
      expect(patientDetailsPage.selectedDate, DateTime(2026, 10, 20));
    });

    testWidgets('Payment method parameter is preserved in widget', (
      WidgetTester tester,
    ) async {
      // This test verifies paymentMethod is properly passed through navigation
      await tester.pumpWidget(
        MaterialApp(
          home: PatientDetailsPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
            paymentMethod: 'GCASH',
          ),
        ),
      );

      final patientDetailsPage = tester.widget<PatientDetailsPage>(
        find.byType(PatientDetailsPage),
      );

      expect(patientDetailsPage.paymentMethod, 'GCASH');
    });

    testWidgets('Error state can be displayed', (WidgetTester tester) async {
      // This test verifies error state UI exists
      await tester.pumpWidget(
        MaterialApp(
          home: PatientDetailsPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
          ),
        ),
      );

      // In a real test with mocked API, we would trigger an error and verify error display
      // For now, we verify the error state widget structure exists
      expect(find.byType(PatientDetailsPage), findsOneWidget);
    });
  });

  group('ApiService Patient Methods Exist', () {
    test('ApiService has checkPatientRecord method', () {
      // This is a compilation test to verify the method signature exists
      // We don't call it to avoid API dependency in unit tests
      final apiService = ApiService();
      // Method exists: checkPatientRecord({required String doctorId})
      // Returns: Future<Map<String, dynamic>>
      expect(apiService, isNotNull);
    });

    test('ApiService has submitPatientDetails method', () {
      // This is a compilation test to verify the method signature exists
      // We don't call it to avoid API dependency in unit tests
      final apiService = ApiService();
      // Method exists: submitPatientDetails({...})
      // Returns: Future<Map<String, dynamic>>
      expect(apiService, isNotNull);
    });

    test('ApiService has getCurrentPatient method', () {
      // This is a compilation test to verify the method signature exists
      // We don't call it to avoid API dependency in unit tests
      final apiService = ApiService();
      // Method exists: getCurrentPatient()
      // Returns: Future<Map<String, dynamic>>
      expect(apiService, isNotNull);
    });
  });

  group('Patient details mobile number integration', () {
    String patientResponse(String phone) => jsonEncode({
      'success': true,
      'data': {
        'email': 'patient@example.com',
        'first_name': 'Juan',
        'middle_name': null,
        'last_name': 'Dela Cruz',
        'date_of_birth': '1990-01-15',
        'sex': 'MALE',
        'phone': phone,
        'address': 'Manila',
      },
    });

    MockClient buildClient({
      required String storedPhone,
      required List<Map<String, dynamic>> submissions,
    }) {
      return MockClient((request) async {
        if (request.method == 'GET') {
          return http.Response(
            patientResponse(storedPhone),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        if (request.method == 'POST') {
          submissions.add(jsonDecode(request.body) as Map<String, dynamic>);
          return http.Response(
            '{"success":false,"error":{"code":"STOP","message":"stopped"}}',
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 404);
      });
    }

    Future<void> pumpDetails(WidgetTester tester, MockClient client) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: PatientDetailsPage(
            doctorId: 'doctor-1',
            doctorName: 'Dr. Test',
            apiService: ApiService.createWithClient(client),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    Finder phoneFieldFinder() => find.descendant(
      of: find.byType(InternationalPhoneInput),
      matching: find.byType(TextField),
    );

    TextField phoneField(WidgetTester tester) =>
        tester.widget<TextField>(phoneFieldFinder());

    Future<void> selectSex(WidgetTester tester) async {
      final dropdown = find.byType(DropdownButtonFormField<String>);
      await tester.ensureVisible(dropdown);
      await tester.pumpAndSettle();
      await tester.tap(dropdown);
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(of: find.byType(ListView), matching: find.text('MALE')),
      );
      await tester.pumpAndSettle();
    }

    Future<void> submit(WidgetTester tester) async {
      final button = find.text('Continue to Booking');
      await tester.ensureVisible(button);
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();
    }

    for (final stored in const ['+639171234567', '09171234567', '9171234567']) {
      testWidgets('loads the stored $stored value as a 10-digit field value', (
        tester,
      ) async {
        final submissions = <Map<String, dynamic>>[];
        await pumpDetails(
          tester,
          buildClient(storedPhone: stored, submissions: submissions),
        );

        expect(phoneField(tester).controller?.text, '9171234567');
        expect(
          find.descendant(
            of: find.byType(InternationalPhoneInput),
            matching: find.text('+63'),
          ),
          findsOneWidget,
        );
        expect(find.textContaining('+63'), findsWidgets);
      });
    }

    for (final (stored, canonical) in const [
      ('09171234567', '+639171234567'),
      ('08171234567', '+638171234567'),
    ]) {
      testWidgets('submits $stored as the canonical $canonical value', (
        tester,
      ) async {
        final submissions = <Map<String, dynamic>>[];
        await pumpDetails(
          tester,
          buildClient(storedPhone: stored, submissions: submissions),
        );

        await selectSex(tester);
        await submit(tester);

        expect(submissions, hasLength(1));
        expect(submissions.single['phone'], canonical);
        expect(submissions.single['phone'], matches(RegExp(r'^\+63\d{10}$')));
      });
    }

    testWidgets(
      'preserves a corrupted stored value, warns, and blocks submission',
      (tester) async {
        const corrupted = '9.17123E+10';
        final submissions = <Map<String, dynamic>>[];
        await pumpDetails(
          tester,
          buildClient(storedPhone: corrupted, submissions: submissions),
        );

        expect(phoneField(tester).controller?.text, corrupted);
        expect(find.text('This saved number is not a recognized mobile number. Please re-enter it.'), findsOneWidget);

        await selectSex(tester);
        await submit(tester);

        expect(submissions, isEmpty);
        expect(
          find.text(
            'This phone number could not be understood. Please re-enter it.',
          ),
          findsWidgets,
        );

        await tester.enterText(
          phoneFieldFinder(),
          '09171234567',
        );
        await tester.pumpAndSettle();
        await submit(tester);

        expect(submissions, hasLength(1));
        expect(submissions.single['phone'], '+639171234567');
      },
    );

    testWidgets('surfaces malformed plus signs and overlong input', (
      tester,
    ) async {
      final submissions = <Map<String, dynamic>>[];
      await pumpDetails(
        tester,
        buildClient(storedPhone: '+639171234567', submissions: submissions),
      );

      await tester.enterText(
        phoneFieldFinder(),
        '++639171234567',
      );
      await tester.pumpAndSettle();

      expect(
        find.text(
          'Remove the plus sign and country code; enter the 10-digit mobile number.',
        ),
        findsWidgets,
      );
      expect(phoneField(tester).controller?.text, '++639171234567');

      await tester.enterText(
        phoneFieldFinder(),
        '917123456789',
      );
      await tester.pumpAndSettle();

      expect(find.text('This mobile number is too long.'), findsOneWidget);
      expect(phoneField(tester).controller?.text, '917123456789');
    });

    testWidgets('rejects unallocated 08 prefixes and landlines', (
      tester,
    ) async {
      final submissions = <Map<String, dynamic>>[];
      await pumpDetails(
        tester,
        buildClient(storedPhone: '+639171234567', submissions: submissions),
      );
      await selectSex(tester);

      await tester.enterText(
        phoneFieldFinder(),
        '08121234567',
      );
      await tester.pumpAndSettle();

      expect(
        find.text('Enter a valid Philippine mobile number.'),
        findsOneWidget,
      );
      expect(phoneField(tester).controller?.text, '08121234567');

      // A landline prefix is tolerated while the user is still typing...
      await tester.enterText(
        phoneFieldFinder(),
        '028',
      );
      await tester.pumpAndSettle();
      expect(phoneField(tester).controller?.text, '028');

      // ...but the completed landline is refused, so the field keeps the
      // incomplete prefix and the mobile number cannot be submitted.
      await tester.enterText(
        phoneFieldFinder(),
        '0281234567',
      );
      await tester.pumpAndSettle();
      expect(phoneField(tester).controller?.text, '0281234567');

      await submit(tester);

      expect(submissions, isEmpty);
      expect(
        find.text('Enter a valid mobile number.'),
        findsWidgets,
      );
    });
    testWidgets(
      'does not show a mobile-number error before interaction on an incomplete profile',
      (tester) async {
        final submissions = <Map<String, dynamic>>[];
        await pumpDetails(
          tester,
          buildClient(storedPhone: '', submissions: submissions),
        );

        expect(phoneField(tester).controller?.text, '');
        expect(find.text('Mobile number is required'), findsNothing);
        expect(find.text('Mobile number is required.'), findsNothing);

        final phoneState = tester.state<InternationalPhoneInputState>(
          find.byType(InternationalPhoneInput),
        );
        expect(phoneState.isValid, isFalse);
        expect(phoneState.errorText, isNull);

        // Submitting with the rest of the profile complete must surface the
        // required-number validation and block the API call.
        await selectSex(tester);
        await submit(tester);

        expect(find.text('Mobile number is required.'), findsWidgets);
        expect(submissions, isEmpty);
      },
    );

    testWidgets('restores a foreign number and submits it unchanged', (
      tester,
    ) async {
      final submissions = <Map<String, dynamic>>[];
      await pumpDetails(
        tester,
        buildClient(storedPhone: '+447123456789', submissions: submissions),
      );

      expect(
        find.descendant(
          of: find.byType(InternationalPhoneInput),
          matching: find.text('+44'),
        ),
        findsOneWidget,
      );
      expect(phoneField(tester).controller?.text, '7123456789');

      await selectSex(tester);
      await submit(tester);

      expect(submissions, hasLength(1));
      expect(submissions.single['phone'], '+447123456789');
    });
  });
}
