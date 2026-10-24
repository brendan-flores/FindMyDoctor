import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show visibleForTesting;
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../navigation/app_navigator.dart';
import 'api_service.dart';

/// Bridges the mobile application with the backend push-notification
/// infrastructure.
///
/// The native iOS/Android host is responsible for obtaining the FCM/APNs
/// device token (all provider credentials stay on the backend). The host
/// exposes the token through the `findmydoctor/push` method channel and
/// forwards notification taps through the `onNotificationTap` method call.
/// The service registers that token with the authenticated user, removes it
/// on logout, and opens only authorized conversation threads when a
/// NEW_PATIENT_MESSAGE or NEW_SECRETARY_MESSAGE notification is tapped.
class PushNotificationService {
  PushNotificationService._() : _apiService = ApiService();

  /// Test-only constructor that lets tests inject a stub API service
  /// instead of the HTTP-backed singleton.
  @visibleForTesting
  PushNotificationService.withApiService(this._apiService);

  static final PushNotificationService instance = PushNotificationService._();

  static const MethodChannel channel = MethodChannel('findmydoctor/push');

  static const String deviceTokenIdKey = 'device_token_id';
  static const String deviceTokenKey = 'device_token';

  /// Stored user intent for the Profile push-notifications switch. Defaults
  /// to enabled so the switch matches the existing auto-registration at
  /// startup for users who have never opened the Profile screen.
  static const String pushEnabledKey = 'push_notifications_enabled';

  final ApiService _apiService;
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;

    channel.setMethodCallHandler(_handleNativeMethodCall);

    try {
      final initial = await channel.invokeMethod<dynamic>(
        'getInitialNotification',
      );
      if (initial is Map) {
        await handleNotificationTap(Map<String, dynamic>.from(initial));
      }
    } on MissingPluginException {
      // No native push host is configured in this build.
    } catch (_) {
      // Push is best-effort and must never block app startup.
    }
  }

  /// Registers this device for the currently authenticated user.
  ///
  /// A token can be supplied directly by the native host (or tests). When it
  /// is omitted the service asks the native host for the current FCM/APNs
  /// token. Registration is silently skipped when no token is available.
  ///
  /// Returns true only when a device token was actually registered with the
  /// backend, so the Profile switch can give real feedback. Startup and
  /// token-refresh callers ignore the result.
  Future<bool> registerForCurrentUser({String? token}) async {
    await initialize();

    var deviceToken = token?.trim();
    if (deviceToken == null || deviceToken.isEmpty) {
      deviceToken = await _loadTokenFromHost();
    }
    if (deviceToken == null || deviceToken.isEmpty) {
      return false;
    }

    try {
      final response = await _apiService.registerDeviceToken(
        token: deviceToken,
        provider: Platform.isIOS ? 'APNS' : 'FCM',
        platform: Platform.isIOS
            ? 'IOS'
            : Platform.isAndroid
            ? 'ANDROID'
            : 'WEB',
        deviceInfo: Platform.operatingSystemVersion,
      );

      if (response['success'] == true && response['data'] is Map) {
        final data = Map<String, dynamic>.from(response['data'] as Map);
        final prefs = await SharedPreferences.getInstance();
        final id = data['id']?.toString();
        if (id != null && id.isNotEmpty) {
          await prefs.setString(deviceTokenIdKey, id);
        }
        await prefs.setString(deviceTokenKey, deviceToken);
        return true;
      }
      return false;
    } catch (_) {
      // Push registration is best-effort; the chat itself remains usable.
      return false;
    }
  }

  /// Removes this device's push registration for the current user using the
  /// existing DELETE /notifications/device-tokens/:id call and clears the
  /// locally cached token ids. Idempotent: without a stored registration it
  /// simply clears local state and reports success.
  Future<bool> disableForCurrentUser() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final id = prefs.getString(deviceTokenIdKey);
      if (id != null && id.isNotEmpty) {
        final response = await _apiService.removeDeviceToken(id);
        if (response['success'] != true) {
          return false;
        }
      }
    } catch (_) {
      return false;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(deviceTokenIdKey);
    await prefs.remove(deviceTokenKey);
    return true;
  }

  /// Reads the stored push preference for this device. Users who have never
  /// toggled the switch are treated as enabled, matching the existing
  /// auto-registration behavior at startup.
  Future<bool> isPushPreferred() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(pushEnabledKey) ?? true;
  }

  Future<void> setPushPreferred(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(pushEnabledKey, value);
  }

  /// Handles a notification tap and opens the conversation thread only when
  /// the authenticated user is authorized to access that conversation.
  Future<void> handleNotificationTap(Map<String, dynamic> data) async {
    final type = (data['type'] ?? '').toString();
    if (type != 'NEW_PATIENT_MESSAGE' && type != 'NEW_SECRETARY_MESSAGE') {
      return;
    }

    final conversationId = (data['conversationId'] ??
            data['conversation_id'] ??
            '')
        .toString();
    if (conversationId.isEmpty ||
        conversationId == 'null' ||
        conversationId == 'undefined') {
      return;
    }

    try {
      final userResponse = await _apiService.getCurrentUser();
      if (userResponse['success'] != true || userResponse['data'] is! Map) {
        return;
      }

      final user = Map<String, dynamic>.from(userResponse['data'] as Map);
      final role = (user['role'] ?? '').toString();

      // A patient-message notification belongs to secretaries; a
      // secretary-message notification belongs to patients.
      if (type == 'NEW_PATIENT_MESSAGE' && role != 'SECRETARY') return;
      if (type == 'NEW_SECRETARY_MESSAGE' && role != 'PATIENT') return;

      // The conversation list is already scoped by the backend to the
      // caller's authorized conversations. Membership therefore doubles as
      // the authorization check before opening the deep link.
      final conversationsResponse = await _apiService.getConversations();
      if (conversationsResponse['success'] != true ||
          conversationsResponse['data'] is! List) {
        return;
      }

      final isAuthorized = (conversationsResponse['data'] as List).any(
        (conversation) =>
            conversation is Map &&
            conversation['id']?.toString() == conversationId,
      );
      if (!isAuthorized) return;

      final navigator = AppNavigator.key.currentState;
      if (navigator == null) return;

      await navigator.pushNamed(
        '/conversation-thread',
        arguments: {'conversationId': conversationId},
      );
    } catch (_) {
      // Never surface push-deep-link failures to the user.
    }
  }

  Future<String?> _loadTokenFromHost() async {
    try {
      final token = await channel.invokeMethod<String>('getToken');
      if (token != null && token.trim().isNotEmpty) {
        return token.trim();
      }
    } on MissingPluginException {
      // No native push host is configured in this build.
    } catch (_) {
      // Fall through to the locally cached token, if any.
    }

    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(deviceTokenKey);
    return cached != null && cached.trim().isNotEmpty ? cached.trim() : null;
  }

  Future<dynamic> _handleNativeMethodCall(MethodCall call) async {
    final arguments = call.arguments;

    if (call.method == 'onNotificationTap' && arguments is Map) {
      await handleNotificationTap(Map<String, dynamic>.from(arguments));
    } else if (call.method == 'onTokenRefresh' && arguments is String) {
      await registerForCurrentUser(token: arguments);
    }

    return null;
  }
}
