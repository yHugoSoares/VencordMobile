import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'js_bridge.dart';

class WebViewShell extends StatefulWidget {
  const WebViewShell({super.key});

  @override
  State<WebViewShell> createState() => _WebViewShellState();
}

class _WebViewShellState extends State<WebViewShell> with WidgetsBindingObserver {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _vencordInjected = false;
  final JsBridge _jsBridge = JsBridge();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _jsBridge.onCallUnsupported = _showCallFallbackDialog;
    _jsBridge.onCallAttempted = _showCallFallbackDialog;
    _controller = _createWebView();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  WebViewController _createWebView() {
    final ctrl = WebViewController();
    ctrl.setJavaScriptMode(JavaScriptMode.unrestricted);
    ctrl.setBackgroundColor(const Color(0xFF202225));

    // Mobile Android Chrome user-agent → Discord serves responsive mobile web app
    ctrl.setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 '
      'Vemobile/0.3.0',
    );

    ctrl.setNavigationDelegate(
      NavigationDelegate(
        onPageStarted: (_) {
          if (mounted) setState(() => _isLoading = true);
        },
        onPageFinished: (_) {
          if (mounted) setState(() => _isLoading = false);
          _injectVencordBundle();
        },
        onWebResourceError: (error) {
          debugPrint('[Vemobile] Web error: ${error.description}');
        },
        onNavigationRequest: (request) {
          // Parse the URL properly for host matching (fixes 2FA, auth redirects)
          final uri = Uri.tryParse(request.url);
          if (uri == null) return NavigationDecision.navigate;

          // Allow all Discord-owned domains
          if (uri.host == 'discord.com' ||
              uri.host.endsWith('.discord.com') ||
              uri.host.endsWith('.discordapp.com') ||
              uri.host.endsWith('.discordapp.net') ||
              uri.host.endsWith('.discord.gg') ||
              uri.host.endsWith('.discord.media') ||
              uri.host.endsWith('.discordcdn.com')) {
            return NavigationDecision.navigate;
          }

          // Allow auth/captcha providers (needed for login + 2FA)
          if (uri.host.endsWith('hcaptcha.com') ||
              uri.host.endsWith('recaptcha.net') ||
              uri.host == 'www.google.com' ||
              uri.host.endsWith('.google.com') ||
              uri.host.endsWith('cloudflare.com') ||
              uri.host.endsWith('stripe.com') ||
              uri.host.endsWith('paypal.com')) {
            return NavigationDecision.navigate;
          }

          // Everything else — open in native browser
          _openExternalUrl(request.url);
          return NavigationDecision.prevent;
        },
      ),
    );

    ctrl.addJavaScriptChannel(
      'VemobileBridge',
      onMessageReceived: (message) => _jsBridge.handleJsMessage(ctrl, message.message),
    );

    // Load Discord directly — no fragment, Discord handles initial route
    ctrl.loadRequest(Uri.parse('https://discord.com/app'));

    return ctrl;
  }

  Future<void> _injectVencordBundle() async {
    if (_vencordInjected) return;
    _vencordInjected = true;

    try {
      final vemobileJs = await rootBundle.loadString('assets/vemobile.js');
      await _controller.runJavaScript(vemobileJs);
      debugPrint('[Vemobile] Bundle injected');
    } catch (e) {
      debugPrint('[Vemobile] Bundle injection failed: $e');
      _vencordInjected = false;
    }
  }

  Future<void> _openExternalUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {}
  }

  void _showCallFallbackDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF2B2D31),
        title: const Text('Voice/Video Calls', style: TextStyle(color: Colors.white)),
        content: const Text(
          'WebRTC voice/video calls are not supported in this version.\n\n'
          'Open the native Discord app for calls?',
          style: TextStyle(color: Color(0xFF949BA4)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Color(0xFF949BA4))),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(ctx);
              _openExternalUrl('discord://discord.com/channels/@me');
            },
            child: const Text('Open Discord'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF202225),
      body: SafeArea(
        bottom: false,
        top: false,
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading)
              Positioned(
                top: 0, left: 0, right: 0,
                child: LinearProgressIndicator(
                  backgroundColor: Colors.grey[800],
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF5865F2)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
