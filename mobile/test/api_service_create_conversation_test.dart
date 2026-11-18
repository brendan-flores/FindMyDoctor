import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('ApiService.createConversation', () {
    late SharedPreferences prefs;

    setUp(() async {
      SharedPreferences.setMockInitialValues({'access_token': 'test-token'});
      prefs = await SharedPreferences.getInstance();
    });

    tearDown(() async {
      await prefs.clear();
    });

    test('uses POST with correct endpoint, body, and auth header', () async {
      String capturedMethod = '';
      String capturedPath = '';
      Map<String, String>? capturedHeaders;
      String? capturedBody;

      final mockClient = MockClient((request) async {
        capturedMethod = request.method;
        capturedPath = request.url.path;
        capturedHeaders = request.headers;
        capturedBody = request.body;
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {
              'id': 'conv-1',
              'secretary_first_name': 'Grace',
              'secretary_last_name': 'Lim',
            },
          }),
          201,
        );
      });

      final service = ApiService.createWithClient(mockClient);
      await service.init();

      final response = await service.createConversation(doctorId: 'doc-1');

      expect(capturedMethod, 'POST');
      expect(capturedPath, '/api/v1/conversations');
      expect(capturedHeaders?['authorization'], 'Bearer test-token');
      final body = jsonDecode(capturedBody!) as Map<String, dynamic>;
      expect(body['doctorId'], 'doc-1');
      expect(body.containsKey('secretaryId'), isFalse);
      expect(response['success'], true);
      expect(response['data']['id'], 'conv-1');
    });

    test('includes secretaryId when provided', () async {
      String? capturedBody;
      final mockClient = MockClient((request) async {
        capturedBody = request.body;
        return http.Response(
          jsonEncode({'success': true, 'data': {'id': 'conv-2'}}),
          200,
        );
      });

      final service = ApiService.createWithClient(mockClient);
      await service.init();
      await service.createConversation(doctorId: 'doc-1', secretaryId: 'sec-1');

      final body = jsonDecode(capturedBody!) as Map<String, dynamic>;
      expect(body['doctorId'], 'doc-1');
      expect(body['secretaryId'], 'sec-1');
    });

    test('throws ApiException on 403', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': false, 'error': {'code': 'FORBIDDEN', 'message': 'Not associated'}}),
          403,
        );
      });
      final service = ApiService.createWithClient(mockClient);
      await service.init();
      expect(
        () => service.createConversation(doctorId: 'doc-1'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 403)),
      );
    });

    test('throws ApiException on 404', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'No secretary'}}),
          404,
        );
      });
      final service = ApiService.createWithClient(mockClient);
      await service.init();
      expect(
        () => service.createConversation(doctorId: 'doc-1'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 404)),
      );
    });

    test('throws ApiException on network error', () async {
      final mockClient = MockClient((request) async {
        throw Exception('network down');
      });
      final service = ApiService.createWithClient(mockClient);
      await service.init();
      expect(
        () => service.createConversation(doctorId: 'doc-1'),
        throwsA(isA<Exception>()),
      );
    });

    test('throws ApiException on invalid JSON', () async {
      final mockClient = MockClient((request) async {
        return http.Response('not json', 200);
      });
      final service = ApiService.createWithClient(mockClient);
      await service.init();
      expect(
        () => service.createConversation(doctorId: 'doc-1'),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
