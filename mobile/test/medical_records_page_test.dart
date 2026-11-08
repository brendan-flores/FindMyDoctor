import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
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

/// Mocks the prescription detail + PDF URL endpoints used by
/// [PrescriptionDetailPage].
ApiService buildMockPdfApiService({
  bool pdfUrlFails = false,
  String signedUrl = 'https://example.supabase.co/storage/v1/object/sign/prescriptions/p.pdf?token=abc',
}) {
  final mockClient = MockClient((request) async {
    final path = request.url.path;
    if (path.endsWith('/prescriptions/prescription-1/pdf-url')) {
      if (pdfUrlFails) {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {
              'code': 'SERVER_ERROR',
              'message': 'Failed to generate signed URL',
            },
          }),
          500,
        );
      }
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {'signedUrl': signedUrl},
          'message': 'Signed URL generated successfully',
        }),
        200,
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
    if (path.endsWith('/prescriptions/prescription-1/pdf-url')) {
      return http.Response(
        jsonEncode({
          'success': true,
          'data': {
            'signedUrl':
                'https://example.supabase.co/storage/v1/object/sign/prescriptions/p.pdf?token=abc',
          },
          'message': 'Signed URL generated successfully',
        }),
        200,
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

void main() {
  group('Prescription model parsing', () {
    test('parses medication_count delivered as a bigint string', () {
      final prescription =
          Prescription.fromJson(buildPrescription({'medication_count': '3'}));

      expect(prescription.medicationCount, 3);
    });

    test('parses medication_count delivered as a number', () {
      final prescription =
          Prescription.fromJson(buildPrescription({'medication_count': 4}));

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

  group('Visit model parsing', () {
    test('parses doctor_professional_photo_url', () {
      final visit = Visit.fromJson(buildVisit({}));

      expect(
        visit.doctorProfessionalPhotoUrl,
        'https://example.com/juan.png',
      );
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
        MaterialApp(
          home: MedicalRecordsPage(apiService: apiService),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets(
      'History tab shows "Dr." prefix and the visit doctor photo',
      (WidgetTester tester) async {
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
      },
    );

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
        MaterialApp(
          navigatorKey: navigatorKey,
          home: home,
        ),
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
        final apiService = buildMockApiService(
          visits: [buildVisit({})],
        );
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
              openUrl: (uri) async => true,
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

    testWidgets(
      'returning from a prescription keeps the tab and date filter',
      (WidgetTester tester) async {
        final recent = DateTime.now().subtract(const Duration(days: 2));
        final recentIso = recent.toUtc().toIso8601String();
        final apiService = buildMockApiService(
          visits: [buildVisit({'visit_date': recentIso})],
          prescriptions: [buildPrescription({'prescription_date': recentIso})],
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
      },
    );

    testWidgets(
      'back button works on a desktop-sized window',
      (WidgetTester tester) async {
        tester.view.physicalSize = const Size(1920, 1080);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        final apiService = buildMockApiService(
          visits: [buildVisit({})],
        );
        await pumpWithNavigator(
          tester,
          apiService: apiService,
          home: const Scaffold(body: Center(child: Text('Dummy Home'))),
        );

        expect(tester.takeException(), isNull);
        await tester.tap(find.byIcon(Icons.arrow_back_ios_new));
        await tester.pumpAndSettle();

        expect(find.text('Dummy Home'), findsOneWidget);
      },
    );
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
      Future<bool> Function(Uri)? openUrl,
    }) async {
      await apiService.init();

      await tester.pumpWidget(
        MaterialApp(
          home: PrescriptionDetailPage(
            prescriptionId: 'prescription-1',
            apiService: apiService,
            openUrl: openUrl,
          ),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets(
      'opens the signed PDF url in an external application',
      (WidgetTester tester) async {
        final apiService = buildMockPdfApiService();
        Uri? openedUri;
        await pumpDetailPage(
          tester,
          apiService: apiService,
          openUrl: (uri) async {
            openedUri = uri;
            return true;
          },
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Download PDF'), findsOneWidget);

        await tester.tap(find.text('Download PDF'));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(
          openedUri?.toString(),
          'https://example.supabase.co/storage/v1/object/sign/prescriptions/p.pdf?token=abc',
        );
        expect(find.text('Could not open PDF'), findsNothing);
      },
    );

    testWidgets(
      'shows a retryable error when the PDF cannot be opened',
      (WidgetTester tester) async {
        final apiService = buildMockPdfApiService();
        await pumpDetailPage(
          tester,
          apiService: apiService,
          openUrl: (uri) async => false,
        );

        await tester.tap(find.text('Download PDF'));
        await tester.pumpAndSettle();

        expect(find.text('Could not open PDF'), findsOneWidget);
        // The button stays available so the user can retry
        expect(find.text('Download PDF'), findsOneWidget);
      },
    );

    testWidgets(
      'shows an error when the PDF url cannot be generated',
      (WidgetTester tester) async {
        final apiService = buildMockPdfApiService(pdfUrlFails: true);
        await pumpDetailPage(
          tester,
          apiService: apiService,
          openUrl: (uri) async => true,
        );

        await tester.tap(find.text('Download PDF'));
        await tester.pumpAndSettle();

        expect(find.text('Failed to load PDF'), findsOneWidget);
      },
    );
  });
}
