import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'storage_service.dart';

class JsBridge {
  void Function()? onCallUnsupported;
  void Function()? onCallAttempted;
  void Function()? onNavigateBack;

  void handleJsMessage(WebViewController controller, String message) {
    try {
      final data = jsonDecode(message) as Map<String, dynamic>;
      final type = data['type'] as String? ?? '';
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
        case 'goBack':
          onNavigateBack?.call();
      }
    } catch (_) {}
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
          result = {'platform': defaultTargetPlatform.toString(), 'appVersion': '0.4.0'};
        case 'getFCMToken':
          result = {'token': await StorageService.getString('push_token') ?? ''};
        default:
          result = {'error': 'Unknown: $method'};
      }
      controller.runJavaScript(
        "window.__VEMOBILE__&&window.__VEMOBILE__.callbacks['$callId']&&"
        "window.__VEMOBILE__.callbacks['$callId'](${jsonEncode({'value': result})})",
      );
    } catch (e) {
      controller.runJavaScript(
        "window.__VEMOBILE__&&window.__VEMOBILE__.callbacks['$callId']&&"
        "window.__VEMOBILE__.callbacks['$callId'](${jsonEncode({'error': '$e'})})",
      );
    }
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }
}
