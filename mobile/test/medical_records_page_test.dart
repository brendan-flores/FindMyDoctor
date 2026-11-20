import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/services/file_save_service.dart';
import 'package:mobile/core/widgets/doctor_profile_image.dart';
import 'package:mobile/features/medical-records/models/prescription.dart';
import 'package:mobile/features/medical-records/models/visit.dart';
import 'package:mobile/features/medical-records/presentation/medical_records_page.dart';
import 'package:mobile/features/medical-records/presentation/prescription_detail_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Builds a visit payload shaped like `GET /api/v1/visits/me`.
///
/// [extra] is merged over the defaults so tests can vary individual fields.
Map<String, dynamic> buildVisit(Map<String, dynamic> extra) {
  return {
    'id': 'visit-1',
    'patient_id': 'patient-1',
    'doctor_id': 'doctor-1',
    'visit_date': '2026-10-20T10:00:00.000Z',
    'diagnosis': 'Seasonal flu',
    'notes': 'Rest and hydrate',
    'doctor_first_name': 'Juan',
    'doctor_last_name': 'Dela Cruz',
    'doctor_professional_photo_url': 'https://example.com/juan.png',
    'appointment_id': 'appointment-1',
    ...extra,
  };
}

/// Builds a prescription payload shaped like `GET /api/v1/prescriptions/me`.
///
/// `medication_count` is a PostgreSQL bigint (COUNT(*)), which the
/// node-postgres driver delivers as a JSON string.
Map<String, dynamic> buildPrescription(Map<String, dynamic> extra) {
  return {
    'id': 'prescription-1',
    'visit_id': 'visit-1',
    'patient_id': 'patient-1',
    'doctor_id': 'doctor-1',
    'prescription_date': '2026-10-20T00:00:00.000Z',
    'notes': null,
    'doctor_first_name': 'Juan',
    'doctor_last_name': 'Dela Cruz',
    'has_pdf': true,
    'medication_count': '2',
    ...extra,
  };
}

/// Builds a prescription detail payload shaped like `GET /api/v1/prescriptions/:id`.
Map<String, dynamic> buildPrescriptionDetail(Map<String, dynamic> extra) {
  return {
    'id': 'prescription-1',
    'visit_id': 'visit-1',
    'patient_id': 'patient-1',
    'doctor_id': 'doctor-1',
    'prescription_date': '2026-10-20T00:00:00.000Z',
    'notes': null,
    'doctor_first_name': 'Juan',
    'doctor_last_name': 'Dela Cruz',
    'has_pdf': true,
    'items': [
      {
        'medication_name': 'Amoxicillin',
        'dosage': '500mg',
        'frequency': '3x daily',
        'duration': '7 days',
        'instructions': 'After meals',
      },
    ],
    ...extra,
  };
}

/// Mocks the prescription detail + PDF download endpoints used by
/// [PrescriptionDetailPage].
ApiService buildMockPdfApiService({
  bool pdfDownloadFails = false,
  String fileName = 'FLORES_Beavz_RX-20261020-ABCDEF12.pdf',
  Map<String, dynamic>? detail,
}) {
  final mockClient = MockClient((request) async {
    final path = request.url.path;
    if (path.endsWith('/prescriptions/prescription-1/download')) {
      if (pdfDownloadFails) {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {
              'code': 'SERVER_ERROR',
              'message': 'Failed to download prescription PDF',
            },
          }),
          500,
        );
      }
      return http.Response.bytes(
        utf8.encode('%PDF-1.7 prescription'),
        200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="$fileName"',
        },
      );
    }
    if (path.endsWith('/prescriptions/prescription-1')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'data': buildPrescriptionDetail(detail ?? {}),
        }),
        200,
      );
    }
    return http.Response('Not found', 404);
  });
  return ApiService.createWithClient(mockClient);
}

ApiService buildMockApiService({
  List<Map<String, dynamic>>? visits,
  List<Map<String, dynamic>>? prescriptions,
  bool prescriptionsFail = false,
}) {
  final mockClient = MockClient((request) async {
    final path = request.url.path;
    if (path.endsWith('/visits/me')) {
      return http.Response(
        jsonEncode({'success': true, 'data': visits ?? []}),
        200,
      );
    }
    if (path.endsWith('/prescriptions/me')) {
      if (prescriptionsFail) {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {
              'code': 'SERVER_ERROR',
              'message': 'Failed to fetch prescriptions',
            },
          }),
          500,
        );
      }
      return http.Response(
        jsonEncode({'success': true, 'data': prescriptions ?? []}),
        200,
      );
    }
    if (path.endsWith('/prescriptions/prescription-1/download')) {
      return http.Response.bytes(
        utf8.encode('%PDF-1.7 prescription'),
        200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition':
              'attachment; filename="FLORES_Beavz_RX-20261020-ABCDEF12.pdf"',
        },
      );
    }
    if (path.endsWith('/prescriptions/prescription-1')) {
      return http.Response(
        jsonEncode({'success': true, 'data': buildPrescriptionDetail({})}),
        200,
      );
    }
    return http.Response('Not found', 404);
  });
  return ApiService.createWithClient(mockClient);
}

/// Converts a local calendar day into an ISO instant that round-trips back to
/// the same local day in any timezone.
String localDateToIso(DateTime date) {
  return DateTime(
    date.year,
    date.month,
    date.day,
    12,
  ).toUtc().toIso8601String();
}

void main() {
  group('Prescription model parsing', () {
    test('parses medication_count delivered as a bigint string', () {
      final prescription = Prescription.fromJson(
        buildPrescription({'medication_count': '3'}),
      );

      expect(prescription.medicationCount, 3);
    });

    test('parses medication_count delivered as a number', () {
      final prescription = Prescription.fromJson(
        buildPrescription({'medication_count': 4}),
      );

      expect(prescription.medicationCount, 4);
    });

    test('defaults medication_count to 0 when missing or unparseable', () {
      final missing = Prescription.fromJson(
        buildPrescription({'medication_count': null}),
      );
      final unparseable = Prescription.fromJson(
        buildPrescription({'medication_count': 'many'}),
      );

      expect(missing.medicationCount, 0);
      expect(unparseable.medicationCount, 0);
    });
  });

  group('PrescriptionDetail model parsing', () {
    test('parses the professional prescription detail payload', () {
      final detail = PrescriptionDetail.fromJson(
        buildPrescriptionDetail({
          'prescription_number': 'RX-20261020-ABCD1234',
          'patient_first_name': 'Maria',
          'patient_middle_name': 'Santos',
          'patient_last_name': 'Cruz',
          'date_of_birth': '1990-05-14T00:00:00.000Z',
          'sex': 'FEMALE',
          'doctor_middle_name': 'Reyes',
          'doctor_specialty': 'Internal Medicine',
          'doctor_credentials': 'MD',
          'prc_license_number': 'PRC-7654321',
          'practice_name': 'Riverside Clinic',
          'practice_address': '12 Mabini St.',
          'practice_phone': '0281234567',
          'room_number': '204',
          'reason_for_visit': 'Persistent cough',
          'diagnosis': 'Acute bronchitis',
          'replaces_prescription_number': 'RX-20261010-9999AAAA',
          'items': [
            {
              'id': 'item-1',
              'medication_name': 'Amoxicillin',
              'dosage': '500mg',
              'frequency': '3x daily',
              'duration': '7 days',
              'quantity': 21,
              'instructions': 'After meals',
            },
            {
              'id': 'item-2',
              'medication_name': 'Paracetamol',
              'quantity': '12',
            },
          ],
        }),
      );

      expect(detail.prescriptionNumber, 'RX-20261020-ABCD1234');
      expect(detail.patientFullName, 'Maria Santos Cruz');
      expect(detail.formattedSex, 'Female');
      expect(detail.patientAge, isNotNull);
      expect(detail.doctorFullName, 'Juan Reyes Dela Cruz');
      expect(detail.doctorSpecialty, 'Internal Medicine');
      expect(detail.doctorCredentials, 'MD');
      expect(detail.prcLicenseNumber, 'PRC-7654321');
      expect(detail.practiceName, 'Riverside Clinic');
      expect(detail.practiceAddress, '12 Mabini St.');
      expect(detail.practicePhone, '0281234567');
      expect(detail.roomNumber, '204');
      expect(detail.reasonForVisit, 'Persistent cough');
      expect(detail.diagnosis, 'Acute bronchitis');
      expect(detail.replacesPrescriptionNumber, 'RX-20261010-9999AAAA');
      expect(detail.items, hasLength(2));
      expect(detail.items[0].quantity, 21);
      // quantity may arrive as a numeric string from PostgreSQL.
      expect(detail.items[1].quantity, 12);
    });

    test('tolerates a missing items array', () {
      final detail = PrescriptionDetail.fromJson(
        buildPrescriptionDetail({'items': null}),
      );

      expect(detail.items, isEmpty);
    });
  });

  group('Visit model parsing', () {
    test('parses doctor_professional_photo_url', () {
      final visit = Visit.fromJson(buildVisit({}));

      expect(visit.doctorProfessionalPhotoUrl, 'https://example.com/juan.png');
    });

    test('returns null photo url when missing or empty', () {
      final missing = Visit.fromJson(
        buildVisit({'doctor_professional_photo_url': null}),
      );
      final empty = Visit.fromJson(
        buildVisit({'doctor_professional_photo_url': ''}),
      );

      expect(missing.doctorProfessionalPhotoUrl, isNull);
      expect(empty.doctorProfessionalPhotoUrl, isNull);
    });
  });

  group('MedicalRecordsPage', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpPage(
      WidgetTester tester, {
      required ApiService apiService,
    }) async {
      await apiService.init();

      await tester.pumpWidget(
        MaterialApp(home: MedicalRecordsPage(apiService: apiService)),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets('History tab shows "Dr." prefix and the visit doctor photo', (
      WidgetTester tester,
    ) async {
      final apiService = buildMockApiService(
        visits: [
          buildVisit({}),
          buildVisit({
            'id': 'visit-2',
            'doctor_first_name': 'Maria',
            'doctor_last_name': 'Santos',
            'doctor_professional_photo_url': null,
          }),
        ],
      );
      await pumpPage(tester, apiService: apiService);

      expect(tester.takeException(), isNull);
      expect(find.text('Dr. Juan Dela Cruz'), findsOneWidget);
      expect(find.text('Dr. Maria Santos'), findsOneWidget);

      final images = tester
          .widgetList<DoctorProfileImage>(find.byType(DoctorProfileImage))
          .toList();
      expect(images, hasLength(2));
      expect(images[0].photoUrl, 'https://example.com/juan.png');
      // Falls back to the default avatar when the doctor has no photo
      expect(images[1].photoUrl, isNull);
    });

    testWidgets(
      'Prescriptions tab renders prescriptions (bigint medication_count)',
      (WidgetTester tester) async {
        final apiService = buildMockApiService(
          visits: [buildVisit({})],
          prescriptions: [
            buildPrescription({'medication_count': '2'}),
            buildPrescription({
              'id': 'prescription-2',
              'prescription_date': '2026-10-21T00:00:00.000Z',
              'medication_count': '1',
              'doctor_first_name': 'Maria',
              'doctor_last_name': 'Santos',
            }),
          ],
        );
        await pumpPage(tester, apiService: apiService);

        expect(tester.takeException(), isNull);

        await tester.tap(find.text('Prescriptions'));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.text('Failed to load prescriptions'), findsNothing);
        expect(find.text('2 medications'), findsOneWidget);
        expect(find.text('1 medication'), findsOneWidget);
      },
    );

    testWidgets(
      'Prescriptions tab shows a retryable error state when the API fails',
      (WidgetTester tester) async {
        final apiService = buildMockApiService(
          visits: [buildVisit({})],
          prescriptionsFail: true,
        );
        await pumpPage(tester, apiService: apiService);

        expect(tester.takeException(), isNull);

        await tester.tap(find.text('Prescriptions'));
        await tester.pumpAndSettle();

        expect(find.text('Failed to load prescriptions'), findsOneWidget);
        expect(find.text('Retry'), findsOneWidget);
      },
    );
  });

  group('Medical records date filtering', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpPage(
      WidgetTester tester, {
      required ApiService apiService,
    }) async {
      await apiService.init();

      await tester.pumpWidget(
        MaterialApp(home: MedicalRecordsPage(apiService: apiService)),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets(
      'Last 7 days includes cutoff and today for visits and prescriptions',
      (WidgetTester tester) async {
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        final cutoff = today.subtract(const Duration(days: 6));
        final older = cutoff.subtract(const Duration(days: 1));
        final future = today.add(const Duration(days: 1));

        final apiService = buildMockApiService(
          visits: [
            buildVisit({
              'id': 'v-today',
              'diagnosis': 'Visit today',
              'visit_date': localDateToIso(today),
            }),
            buildVisit({
              'id': 'v-cutoff',
              'diagnosis': 'Visit cutoff',
              'visit_date': localDateToIso(cutoff),
            }),
            buildVisit({
              'id': 'v-older',
              'diagnosis': 'Visit older',
              'visit_date': localDateToIso(older),
            }),
            buildVisit({
              'id': 'v-future',
              'diagnosis': 'Visit future',
              'visit_date': localDateToIso(future),
            }),
            buildVisit({
              'id': 'v-null',
              'diagnosis': 'Visit null',
              'visit_date': null,
            }),
          ],
          prescriptions: [
            buildPrescription({
              'id': 'p-today',
              'doctor_last_name': 'TodayRx',
              'prescription_date': localDateToIso(today),
            }),
            buildPrescription({
              'id': 'p-cutoff',
              'doctor_last_name': 'CutoffRx',
              'prescription_date': localDateToIso(cutoff),
            }),
            buildPrescription({
              'id': 'p-older',
              'doctor_last_name': 'OlderRx',
              'prescription_date': localDateToIso(older),
            }),
            buildPrescription({
              'id': 'p-future',
              'doctor_last_name': 'FutureRx',
              'prescription_date': localDateToIso(future),
            }),
            buildPrescription({
              'id': 'p-null',
              'doctor_last_name': 'NullRx',
              'prescription_date': null,
            }),
          ],
        );

        await pumpPage(tester, apiService: apiService);

        await tester.tap(find.byIcon(Icons.filter_list));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Last 7 days'));
        await tester.pumpAndSettle();

        expect(find.text('Visit today'), findsOneWidget);
        expect(find.text('Visit cutoff'), findsOneWidget);
        expect(find.text('Visit older'), findsNothing);
        expect(find.text('Visit future'), findsNothing);
        expect(find.text('Visit null'), findsNothing);

        await tester.tap(find.text('Prescriptions'));
        await tester.pumpAndSettle();

        expect(find.text('Juan TodayRx'), findsOneWidget);
        expect(find.text('Juan CutoffRx'), findsOneWidget);
        expect(find.text('Juan OlderRx'), findsNothing);
        expect(find.text('Juan FutureRx'), findsNothing);
        expect(find.text('Juan NullRx'), findsNothing);
      },
    );

    testWidgets(
      'Last 30 days includes cutoff and excludes older, future, and null',
      (WidgetTester tester) async {
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        final cutoff = today.subtract(const Duration(days: 29));
        final older = cutoff.subtract(const Duration(days: 1));
        final future = today.add(const Duration(days: 1));

        final apiService = buildMockApiService(
          visits: [
            buildVisit({
              'id': 'v-today',
              'diagnosis': 'Visit today',
              'visit_date': localDateToIso(today),
            }),
            buildVisit({
              'id': 'v-cutoff',
              'diagnosis': 'Visit cutoff',
              'visit_date': localDateToIso(cutoff),
            }),
            buildVisit({
              'id': 'v-older',
              'diagnosis': 'Visit older',
              'visit_date': localDateToIso(older),
            }),
            buildVisit({
              'id': 'v-future',
              'diagnosis': 'Visit future',
              'visit_date': localDateToIso(future),
            }),
            buildVisit({
              'id': 'v-null',
              'diagnosis': 'Visit null',
              'visit_date': null,
            }),
          ],
          prescriptions: [
            buildPrescription({
              'id': 'p-today',
              'doctor_last_name': 'TodayRx',
              'prescription_date': localDateToIso(today),
            }),
            buildPrescription({
              'id': 'p-cutoff',
              'doctor_last_name': 'CutoffRx',
              'prescription_date': localDateToIso(cutoff),
            }),
            buildPrescription({
              'id': 'p-older',
              'doctor_last_name': 'OlderRx',
              'prescription_date': localDateToIso(older),
            }),
            buildPrescription({
              'id': 'p-future',
              'doctor_last_name': 'FutureRx',
              'prescription_date': localDateToIso(future),
            }),
            buildPrescription({
              'id': 'p-null',
              'doctor_last_name': 'NullRx',
              'prescription_date': null,
            }),
          ],
        );

        await pumpPage(tester, apiService: apiService);

        await tester.tap(find.byIcon(Icons.filter_list));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Last 30 days'));
        await tester.pumpAndSettle();

        expect(find.text('Visit today'), findsOneWidget);
        expect(find.text('Visit cutoff'), findsOneWidget);
        expect(find.text('Visit older'), findsNothing);
        expect(find.text('Visit future'), findsNothing);
        expect(find.text('Visit null'), findsNothing);

        await tester.tap(find.text('Prescriptions'));
        await tester.pumpAndSettle();

        expect(find.text('Juan TodayRx'), findsOneWidget);
        expect(find.text('Juan CutoffRx'), findsOneWidget);
        expect(find.text('Juan OlderRx'), findsNothing);
        expect(find.text('Juan FutureRx'), findsNothing);
        expect(find.text('Juan NullRx'), findsNothing);
      },
    );

    testWidgets('All time restores records outside the selected range', (
      WidgetTester tester,
    ) async {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final older = today.subtract(const Duration(days: 45));

      final apiService = buildMockApiService(
        visits: [
          buildVisit({
            'id': 'v-recent',
            'diagnosis': 'Visit recent',
            'visit_date': localDateToIso(today),
          }),
          buildVisit({
            'id': 'v-older',
            'diagnosis': 'Visit older',
            'visit_date': localDateToIso(older),
          }),
        ],
        prescriptions: [
          buildPrescription({
            'id': 'p-recent',
            'doctor_last_name': 'RecentRx',
            'prescription_date': localDateToIso(today),
          }),
          buildPrescription({
            'id': 'p-older',
            'doctor_last_name': 'OlderRx',
            'prescription_date': localDateToIso(older),
          }),
        ],
      );

      await pumpPage(tester, apiService: apiService);

      await tester.tap(find.byIcon(Icons.filter_list));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Last 7 days'));
      await tester.pumpAndSettle();

      expect(find.text('Visit recent'), findsOneWidget);
      expect(find.text('Visit older'), findsNothing);

      await tester.tap(find.byIcon(Icons.filter_list));
      await tester.pumpAndSettle();
      await tester.tap(find.text('All time'));
      await tester.pumpAndSettle();

      expect(find.text('Visit recent'), findsOneWidget);
      expect(find.text('Visit older'), findsOneWidget);

      await tester.tap(find.text('Prescriptions'));
      await tester.pumpAndSettle();

      expect(find.text('Juan RecentRx'), findsOneWidget);
      expect(find.text('Juan OlderRx'), findsOneWidget);
    });
  });

  group('Medical records back navigation', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpWithNavigator(
      WidgetTester tester, {
      required ApiService apiService,
      required Widget home,
    }) async {
      await apiService.init();

      final navigatorKey = GlobalKey<NavigatorState>();
      await tester.pumpWidget(
        MaterialApp(navigatorKey: navigatorKey, home: home),
      );
      navigatorKey.currentState!.push(
        MaterialPageRoute(
          builder: (_) => MedicalRecordsPage(apiService: apiService),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets(
      'Medical Records page back button returns to the previous view',
      (WidgetTester tester) async {
        final apiService = buildMockApiService(visits: [buildVisit({})]);
        await pumpWithNavigator(
          tester,
          apiService: apiService,
          home: const Scaffold(body: Center(child: Text('Dummy Home'))),
        );

        expect(tester.takeException(), isNull);
        expect(find.byIcon(Icons.arrow_back_ios_new), findsOneWidget);

        await tester.tap(find.byIcon(Icons.arrow_back_ios_new));
        await tester.pumpAndSettle();

        expect(find.text('Dummy Home'), findsOneWidget);
      },
    );

    testWidgets(
      'Back from a prescription detail returns to the previous view',
      (WidgetTester tester) async {
        final apiService = buildMockPdfApiService();
        await apiService.init();

        final navigatorKey = GlobalKey<NavigatorState>();
        await tester.pumpWidget(
          MaterialApp(
            navigatorKey: navigatorKey,
            home: const Scaffold(body: Center(child: Text('Dummy Home'))),
          ),
        );
        navigatorKey.currentState!.push(
          MaterialPageRoute(
            builder: (_) => PrescriptionDetailPage(
              prescriptionId: 'prescription-1',
              apiService: apiService,
            ),
          ),
        );
        await tester.pumpAndSettle(const Duration(seconds: 2));

        expect(find.byIcon(Icons.arrow_back_ios_new), findsOneWidget);

        await tester.tap(find.byIcon(Icons.arrow_back_ios_new));
        await tester.pumpAndSettle();

        expect(find.text('Dummy Home'), findsOneWidget);
      },
    );

    testWidgets('returning from a prescription keeps the tab and date filter', (
      WidgetTester tester,
    ) async {
      final recent = DateTime.now().subtract(const Duration(days: 2));
      final recentIso = recent.toUtc().toIso8601String();
      final apiService = buildMockApiService(
        visits: [
          buildVisit({'visit_date': recentIso}),
        ],
        prescriptions: [
          buildPrescription({'prescription_date': recentIso}),
        ],
      );
      await pumpWithNavigator(
        tester,
        apiService: apiService,
        home: const Scaffold(body: Center(child: Text('Dummy Home'))),
      );

      expect(tester.takeException(), isNull);

      // Switch to the Prescriptions tab
      await tester.tap(find.text('Prescriptions'));
      await tester.pumpAndSettle();
      expect(find.text('2 medications'), findsOneWidget);

      // Apply the Last 7 days filter
      await tester.tap(find.byIcon(Icons.filter_list));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Last 7 days'));
      await tester.pumpAndSettle();
      expect(find.text('2 medications'), findsOneWidget);

      // Open the prescription detail view
      await tester.tap(find.text('2 medications'));
      await tester.pumpAndSettle(const Duration(seconds: 2));
      expect(find.text('Download PDF'), findsOneWidget);

      // Go back - tab and filter must still be prescriptions + Last 7 days
      await tester.tap(find.byIcon(Icons.arrow_back_ios_new));
      await tester.pumpAndSettle();

      expect(find.text('Dummy Home'), findsNothing);
      expect(find.text('2 medications'), findsOneWidget);
      expect(find.text('Download PDF'), findsNothing);
    });

    testWidgets('back button works on a desktop-sized window', (
      WidgetTester tester,
    ) async {
      tester.view.physicalSize = const Size(1920, 1080);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final apiService = buildMockApiService(visits: [buildVisit({})]);
      await pumpWithNavigator(
        tester,
        apiService: apiService,
        home: const Scaffold(body: Center(child: Text('Dummy Home'))),
      );

      expect(tester.takeException(), isNull);
      await tester.tap(find.byIcon(Icons.arrow_back_ios_new));
      await tester.pumpAndSettle();

      expect(find.text('Dummy Home'), findsOneWidget);
    });
  });

  group('PrescriptionDetailPage PDF download', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpDetailPage(
      WidgetTester tester, {
      required ApiService apiService,
      Future<SavedFile> Function(List<int>, String)? savePdf,
    }) async {
      await apiService.init();

      await tester.pumpWidget(
        MaterialApp(
          home: PrescriptionDetailPage(
            prescriptionId: 'prescription-1',
            apiService: apiService,
            savePdf: savePdf,
          ),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets(
      'saves the authenticated PDF download with a prescription filename',
      (WidgetTester tester) async {
        final apiService = buildMockPdfApiService();
        String? savedFileName;
        List<int>? savedBytes;
        await pumpDetailPage(
          tester,
          apiService: apiService,
          savePdf: (bytes, fileName) async {
            savedBytes = bytes;
            savedFileName = fileName;
            return const SavedFile(
              path: 'Downloads/FLORES_Beavz_RX-20261020-ABCDEF12.pdf',
              displayLocation: 'Downloads',
            );
          },
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Download PDF'), findsOneWidget);

        await tester.ensureVisible(find.text('Download PDF'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Download PDF'));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(savedFileName, 'FLORES_Beavz_RX-20261020-ABCDEF12.pdf');
        expect(savedBytes, utf8.encode('%PDF-1.7 prescription'));
        expect(
          find.textContaining('Prescription saved to Downloads'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'renders the professional prescription layout with all detail sections',
      (WidgetTester tester) async {
        final longInstructions =
            'Take with food. '
            'Continue until the full course is finished.';
        final apiService = buildMockPdfApiService(
          detail: {
            'prescription_number': 'RX-20261020-ABCD1234',
            'patient_first_name': 'Maria',
            'patient_middle_name': 'Santos',
            'patient_last_name': 'Cruz',
            'date_of_birth': '1990-05-14T00:00:00.000Z',
            'sex': 'FEMALE',
            'doctor_middle_name': 'Reyes',
            'doctor_specialty': 'Internal Medicine',
            'doctor_credentials': 'MD',
            'prc_license_number': 'PRC-7654321',
            'doctor_professional_photo_url': null,
            'practice_name': 'Riverside Clinic',
            'practice_address': '12 Mabini St.',
            'practice_phone': '0281234567',
            'room_number': '204',
            'visit_date': '2026-10-20T00:00:00.000Z',
            'reason_for_visit': 'Persistent cough',
            'diagnosis': 'Acute bronchitis',
            'notes': 'Drink plenty of fluids.',
            'replaces_prescription_number': 'RX-20261010-9999AAAA',
            'items': [
              {
                'id': 'item-1',
                'medication_name': 'Amoxicillin',
                'dosage': '500mg',
                'frequency': '3x daily',
                'duration': '7 days',
                'quantity': 21,
                'instructions': 'After meals',
              },
              {
                'id': 'item-2',
                'medication_name': 'Paracetamol',
                'dosage': '500mg',
                'frequency': 'Every 6 hours',
                'duration': '3 days',
                'quantity': 12,
                'instructions': longInstructions,
              },
            ],
          },
        );
        await pumpDetailPage(tester, apiService: apiService);

        expect(tester.takeException(), isNull);

        // Doctor and clinic identity
        expect(find.text('Dr. Juan Reyes Dela Cruz'), findsOneWidget);
        expect(find.text('Internal Medicine'), findsOneWidget);
        expect(find.text('MD'), findsOneWidget);
        expect(find.text('PRC License No.: PRC-7654321'), findsOneWidget);
        expect(find.text('CLINIC INFORMATION'), findsOneWidget);
        expect(find.text('Riverside Clinic · Room 204'), findsOneWidget);
        expect(find.text('12 Mabini St.'), findsOneWidget);
        expect(find.text('Contact: 0281234567'), findsOneWidget);

        // Prescription identity
        expect(find.text('RX-20261020-ABCD1234'), findsOneWidget);
        expect(find.text('Issue date'), findsOneWidget);

        // Patient and consultation
        expect(find.text('Patient Information'), findsOneWidget);
        expect(find.text('Maria Santos Cruz'), findsOneWidget);
        expect(find.text('Female'), findsOneWidget);
        expect(find.text('Consultation'), findsOneWidget);
        expect(find.text('Persistent cough'), findsOneWidget);
        expect(find.text('Acute bronchitis'), findsOneWidget);

        // Medications, quantities, and long instructions
        expect(find.text('Amoxicillin'), findsOneWidget);
        expect(find.text('Paracetamol'), findsOneWidget);
        expect(find.text('Quantity:'), findsNWidgets(2));
        expect(find.text('21'), findsOneWidget);
        expect(find.text('12'), findsOneWidget);
        expect(find.text(longInstructions), findsOneWidget);

        // Notes and replacement reference
        expect(find.text('Doctor\'s Notes'), findsOneWidget);
        expect(find.text('Drink plenty of fluids.'), findsOneWidget);
        expect(find.text('Replacement prescription'), findsOneWidget);
        expect(find.text('Replaces RX-20261010-9999AAAA.'), findsOneWidget);

        expect(find.text('Download PDF'), findsOneWidget);
      },
    );

    testWidgets('shows an error when the PDF cannot be downloaded', (
      WidgetTester tester,
    ) async {
      final apiService = buildMockPdfApiService(pdfDownloadFails: true);
      await pumpDetailPage(tester, apiService: apiService);

      await tester.ensureVisible(find.text('Download PDF'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Download PDF'));
      await tester.pumpAndSettle();

      expect(find.text('Failed to download PDF'), findsOneWidget);
    });
  });

  group('Prescription PDF filename contract', () {
    Uri? requestedUri;

    ApiService buildDownloadApi(String? fileName) {
      final client = MockClient((request) async {
        requestedUri = request.url;
        final headers = <String, String>{'content-type': 'application/pdf'};
        if (fileName != null) {
          headers['content-disposition'] = 'attachment; filename="$fileName"';
        }
        return http.Response.bytes(
          utf8.encode('%PDF-1.7 prescription'),
          200,
          headers: headers,
        );
      });
      return ApiService.createWithClient(client);
    }

    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
      requestedUri = null;
    });

    test(
      'saves the server-provided clinic filename without a sharing query',
      () async {
        final api = buildDownloadApi('FLORES_Beavz_RX-20261020-ABCDEF12.pdf');
        await api.init();

        final download = await api.downloadPrescriptionPdf('prescription-1');

        expect(download.fileName, 'FLORES_Beavz_RX-20261020-ABCDEF12.pdf');
        expect(requestedUri!.queryParameters, isEmpty);
      },
    );

    test('accepts replacement and superseded names', () async {
      final replacementApi = buildDownloadApi(
        'FLORES_Beavz_RX-20261020-ABCDEF12_replaces-41A6B551.pdf',
      );
      await replacementApi.init();
      expect(
        (await replacementApi.downloadPrescriptionPdf('prescription-1'))
            .fileName,
        'FLORES_Beavz_RX-20261020-ABCDEF12_replaces-41A6B551.pdf',
      );

      final supersededApi = buildDownloadApi(
        'FLORES_Beavz_RX-20261020-41A6B551_SUPERSEDED.pdf',
      );
      await supersededApi.init();
      expect(
        (await supersededApi.downloadPrescriptionPdf('prescription-1'))
            .fileName,
        'FLORES_Beavz_RX-20261020-41A6B551_SUPERSEDED.pdf',
      );
    });

    test('rejects a missing or legacy-format server filename', () async {
      final missingApi = buildDownloadApi(null);
      await missingApi.init();
      await expectLater(
        missingApi.downloadPrescriptionPdf('prescription-1'),
        throwsFormatException,
      );

      final legacyApi = buildDownloadApi('RX-abc123.pdf');
      await legacyApi.init();
      await expectLater(
        legacyApi.downloadPrescriptionPdf('prescription-1'),
        throwsFormatException,
      );
    });
  });
}
