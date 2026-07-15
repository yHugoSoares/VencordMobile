import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'storage_service.dart';

class JsBridge {
  // Store pending native calls with their callbacks
  final Map<String, Function(Map<String, dynamic>)> _pendingNativeCalls = {};

  // Called when JS sends a message to the native bridge
  void handleJsMessage(String message) {
    try {
      final data = jsonDecode(message) as Map<String, dynamic>;
      final type = data['type'] as String?;
      final payload = data['data'] as Map<String, dynamic>? ?? {};

      switch (type) {
        case 'bridge':
          _handleNativeCall(payload);
          break;
        case 'openUrl':
          handleOpenUrl(payload);
          break;
        case 'updateAvailable':
          _handleUpdateAvailable(payload);
          break;
        case 'log':
          debugPrint('[Vemobile JS] ${payload['message']}');
          break;
        default:
          debugPrint('[Vemobile] Unknown JS message type: $type');
      }
    } catch (e) {
      debugPrint('[Vemobile] Failed to parse JS message: $e');
    }
  }

  // Handle a native method call from JS
  Future<void> _handleNativeCall(Map<String, dynamic> data) async {
    final callId = data['id'] as String?;
    final method = data['method'] as String?;
    final args = data['args'] as List<dynamic>? ?? [];

    if (callId == null || method == null) return;

    try {
      dynamic result;
      switch (method) {
        case 'requestWakeLock':
          result = await _requestWakeLock();
          break;
        case 'releaseWakeLock':
          result = await _releaseWakeLock();
          break;
        case 'getDeviceInfo':
          result = await _getDeviceInfo();
          break;
        case 'registerPushToken':
          result = await _registerPushToken(args.isNotEmpty ? args[0] as String : '');
          break;
        case 'getFCMToken':
          result = await _getFCMToken();
          break;
        case 'saveData':
          result = await _saveData(args.isNotEmpty ? args[0] as String : '', args.length > 1 ? args[1] as String : '');
          break;
        case 'loadData':
          result = await _loadData(args.isNotEmpty ? args[0] as String : '');
          break;
        case 'clearData':
          result = await _clearData(args.isNotEmpty ? args[0] as String : '');
          break;
        default:
          result = {'error': 'Unknown method: $method'};
      }

      _pendingNativeCalls[callId]?.call({'value': result});
      _pendingNativeCalls.remove(callId);
    } catch (e) {
      _pendingNativeCalls[callId]?.call({'error': e.toString()});
      _pendingNativeCalls.remove(callId);
    }
  }

  // Handle opening external URLs from JS messages
  void handleOpenUrl(Map<String, dynamic> data) {
    final url = data['url'] as String?;
    if (url != null) {
      _launchUrl(url);
    }
  }

  // Called from Flutter code to open a URL
  Future<void> _launchUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;

    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      debugPrint('[Vemobile] Failed to open URL: $e');
    }
  }

  // Handle update available notification
  void _handleUpdateAvailable(Map<String, dynamic> data) {
    final version = data['version'] as String? ?? '';
    debugPrint('[Vemobile] Update available: v$version');
    // TODO: Show in-app notification and download new bundle
  }

  // --- Native Method Implementations ---

  Future<Map<String, dynamic>> _requestWakeLock() async {
    try {
      await const MethodChannel('vemobile/wakelock').invokeMethod('acquire');
      return {'success': true};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> _releaseWakeLock() async {
    try {
      await const MethodChannel('vemobile/wakelock').invokeMethod('release');
      return {'success': true};
    } catch (e) {
      return {'success': false, 'error': e.toString()};
    }
  }

  Future<Map<String, dynamic>> _getDeviceInfo() async {
    return {
      'platform': defaultTargetPlatform.toString(),
      'appVersion': '0.1.0',
    };
  }

  Future<Map<String, dynamic>> _registerPushToken(String token) async {
    await StorageService.setString('push_token', token);
    return {'success': true, 'token': token};
  }

  Future<Map<String, dynamic>> _getFCMToken() async {
    final token = await StorageService.getString('push_token');
    return {'token': token ?? '', 'success': true};
  }

  Future<Map<String, dynamic>> _saveData(String key, String value) async {
    await StorageService.setString(key, value);
    return {'success': true};
  }

  Future<Map<String, dynamic>> _loadData(String key) async {
    final value = await StorageService.getString(key);
    return {'value': value ?? '', 'success': true};
  }

  Future<Map<String, dynamic>> _clearData(String key) async {
    await StorageService.remove(key);
    return {'success': true};
  }

  // Send a message to the JavaScript side (called from Dart)
  void sendToJs(dynamic controller, String type, Map<String, dynamic> data) {
    final message = jsonEncode({'type': type, 'data': data});
    controller.runJavaScript("""
      (function() {
        if (window.__VEMOBILE__) {
          window.__VEMOBILE__.receiveFromNative('$type', ${jsonEncode(data)});
        }
      })();
    """);
  }
}
