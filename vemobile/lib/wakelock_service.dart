import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Android-specific implementation of wake lock using platform channels.
/// On iOS, the system automatically manages screen sleep during calls.
class WakeLockService {
  static const _channel = MethodChannel('vemobile/wakelock');

  static Future<bool> acquire() async {
    if (!Platform.isAndroid) return true;
    try {
      await _channel.invokeMethod('acquire');
      return true;
    } catch (e) {
      debugPrint('[Vemobile] WakeLock acquire failed: $e');
      return false;
    }
  }

  static Future<bool> release() async {
    if (!Platform.isAndroid) return true;
    try {
      await _channel.invokeMethod('release');
      return true;
    } catch (e) {
      debugPrint('[Vemobile] WakeLock release failed: $e');
      return false;
    }
  }
}
