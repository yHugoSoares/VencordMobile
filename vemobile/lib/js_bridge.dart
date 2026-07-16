import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'storage_service.dart';

class JsBridge {
  final Map<String, void Function(Map<String, dynamic>)> _pending = {};
  void Function()? onCallUnsupported;
  void Function()? onCallAttempted;
  void Function(String version, String url)? onUpdateAvailable;

  void handleJsMessage(WebViewController controller, String message) {
    try {
      final data = jsonDecode(message) as Map<String, dynamic>;
      final type = data['type'] as String?;
      final payload = data['data'] as Map<String, dynamic>? ?? {};

      switch (type) {
        case 'bridge':
          _handleNativeCall(controller, payload);
        case 'openUrl':
          _launchUrl(payload['url'] as String? ?? '');
        case 'callUnsupported':
          onCallUnsupported?.call();
        case 'callAttempted':
          onCallAttempted?.call();
        case 'updateAvailable':
          onUpdateAvailable?.call(
            payload['version'] as String? ?? '',
            payload['url'] as String? ?? '',
          );
        case 'log':
          debugPrint('[Vemobile JS] ${payload['message']}');
      }
    } catch (e) {
      debugPrint('[Vemobile] JS message parse error: $e');
    }
  }

  Future<void> _handleNativeCall(WebViewController controller, Map<String, dynamic> data) async {
    final callId = data['id'] as String?;
    final method = data['method'] as String?;
    if (callId == null || method == null) return;

    dynamic result;
    try {
      switch (method) {
        case 'requestWakeLock':
          await const MethodChannel('vemobile/wakelock').invokeMethod('acquire');
          result = {'success': true};
        case 'releaseWakeLock':
          await const MethodChannel('vemobile/wakelock').invokeMethod('release');
          result = {'success': true};
        case 'getDeviceInfo':
          result = {'platform': defaultTargetPlatform.toString(), 'appVersion': '0.2.0'};
        case 'getFCMToken':
          final t = await StorageService.getString('push_token');
          result = {'token': t ?? ''};
        default:
          result = {'error': 'Unknown method: $method'};
      }
      _respondToJs(controller, callId, {'value': result});
    } catch (e) {
      _respondToJs(controller, callId, {'error': e.toString()});
    }
  }

  void _respondToJs(WebViewController controller, String callId, Map<String, dynamic> response) {
    controller.runJavaScript(
      "window.__VEMOBILE__ && window.__VEMOBILE__.callbacks['$callId'] && "
      "window.__VEMOBILE__.callbacks['$callId'](${jsonEncode(response)})",
    );
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {}
  }
}
