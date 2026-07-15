/// Vemobile Notification Service
/// Handles FCM push notifications on Android and APNs on iOS.
///
/// Since the Discord web app in WebView cannot receive native push notifications,
/// we need a relay mechanism. Options:
/// 1. Poll the Discord API for new messages (battery heavy)
/// 2. Use a push relay server that subscribes to Discord's gateway
/// 3. Use Discord's official push notification service (requires token extraction)
///
/// For the MVP, we use local notifications for in-app events and
/// provide a framework for future FCM integration.

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class NotificationService {
  static const _channel = MethodChannel('vemobile/notifications');

  static Future<bool> requestPermission() async {
    try {
      final result = await _channel.invokeMethod('requestPermission');
      return result == true;
    } catch (e) {
      debugPrint('[Vemobile] Notification permission failed: $e');
      return false;
    }
  }

  static Future<void> showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    try {
      await _channel.invokeMethod('showLocalNotification', {
        'title': title,
        'body': body,
        'payload': payload,
      });
    } catch (e) {
      debugPrint('[Vemobile] Show notification failed: $e');
    }
  }
}
