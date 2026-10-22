import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';

void main() {
  group('Payment Receipt Upload Tests', () {
    late ApiService apiService;
    late MockClient mockClient;

    setUp(() {
      mockClient = MockClient((request) async {
        // Simulate successful upload
        if (request.method == 'POST' &&
            request.url.path.contains('/payments/') &&
            request.url.path.contains('/receipt')) {
          return http.Response(
            '{"success": true, "data": {"receiptUrl": "https://supabase.example.com/payment-receipts/receipt_123.jpg"}}',
            200,
          );
        }
        return http.Response('{"error": {"message": "Not found"}}', 404);
      });

      apiService = ApiService.createWithClient(mockClient);
    });

    test('should upload receipt file successfully', () async {
      // Create a temporary test file with unique name
      final tempDir = Directory.systemTemp;
      final testFile = File('${tempDir.path}/test_receipt_${DateTime.now().millisecondsSinceEpoch}.jpg');
      await testFile.writeAsBytes([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG signature

      try {
        final response = await apiService.uploadPaymentReceipt(
          appointmentId: 'test-appointment-id',
          receiptFile: testFile,
        );

        expect(response['success'], isTrue);
        expect(response['data']['receiptUrl'], isNotEmpty);
      } finally {
        // Clean up
        try {
          if (await testFile.exists()) {
            await testFile.delete();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    test('should handle upload error', () async {
      // Create a mock client that returns an error
      final errorClient = MockClient((request) async {
        return http.Response(
          '{"success": false, "error": {"message": "Upload failed", "code": "UPLOAD_ERROR"}}',
          500,
        );
      });

      final errorApiService = ApiService.createWithClient(errorClient);

      final tempDir = Directory.systemTemp;
      final testFile = File('${tempDir.path}/test_receipt_${DateTime.now().millisecondsSinceEpoch}.jpg');
      await testFile.writeAsBytes([0xFF, 0xD8, 0xFF, 0xE0]);

      try {
        expect(
          () => errorApiService.uploadPaymentReceipt(
            appointmentId: 'test-appointment-id',
            receiptFile: testFile,
          ),
          throwsA(isA<ApiException>()),
        );
      } finally {
        try {
          if (await testFile.exists()) {
            await testFile.delete();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });
  });
}
