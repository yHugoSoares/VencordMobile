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

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_vencordInjected) return;
    if (state == AppLifecycleState.paused) {
      _controller.runJavaScript("window.__VEMOBILE__ && window.__VEMOBILE__.callbacks['lifecycle'] && window.__VEMOBILE__.callbacks['lifecycle']({state:'paused'})");
    } else if (state == AppLifecycleState.resumed) {
      _controller.runJavaScript("window.__VEMOBILE__ && window.__VEMOBILE__.callbacks['lifecycle'] && window.__VEMOBILE__.callbacks['lifecycle']({state:'resumed'})");
    }
  }

  WebViewController _createWebView() {
    final ctrl = WebViewController();
    ctrl.setJavaScriptMode(JavaScriptMode.unrestricted);
    ctrl.setBackgroundColor(const Color(0xFF202225));
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
          // 1.5: Allow same-origin (discord.com), block cross-origin
          final url = request.url;
          final currentUri = Uri.tryParse(url);
          if (currentUri == null) return NavigationDecision.prevent;

          // Always allow navigation within discord.com domain
          if (currentUri.host == 'discord.com' ||
              currentUri.host.endsWith('.discord.com') ||
              currentUri.host.endsWith('.discordapp.com') ||
              currentUri.host.endsWith('.discordapp.net') ||
              currentUri.host.endsWith('.discord.gg') ||
              currentUri.host.endsWith('.discord.media') ||
              currentUri.host.endsWith('.discordcdn.com')) {
            return NavigationDecision.navigate;
          }

          // Also allow captcha providers
          if (currentUri.host.endsWith('hcaptcha.com') ||
              currentUri.host.endsWith('recaptcha.net') ||
              currentUri.host.endsWith('google.com/recaptcha') ||
              currentUri.host.endsWith('cloudflare.com')) {
            return NavigationDecision.navigate;
          }

          // Everything else: open in native browser
          _openExternalUrl(url);
          return NavigationDecision.prevent;
        },
      ),
    );
    ctrl.addJavaScriptChannel(
      'VemobileBridge',
      onMessageReceived: (message) => _jsBridge.handleJsMessage(ctrl, message.message),
    );

    // Use iPad Safari user-agent — gets Discord's desktop app (with full features)
    // but with touch-aware behavior (better than desktop Chrome UA on mobile)
    ctrl.setUserAgent(
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 '
      '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 '
      'Vemobile/0.1.0',
    );

    ctrl.loadRequest(Uri.parse('https://discord.com/app'));
    return ctrl;
  }

  Future<void> _injectVencordBundle() async {
    if (_vencordInjected) return;
    _vencordInjected = true;

    try {
      // 1. Inject CSS first (prevents flash of broken layout)
      final vemobileCss = await rootBundle.loadString('assets/vemobile.css');
      final escapedCss = vemobileCss
          .replaceAll('\\', '\\\\')
          .replaceAll("'", "\\'")
          .replaceAll('\n', '\\n')
          .replaceAll('\r', '');
      await _controller.runJavaScript("""
        (function(){
          var s=document.getElementById('vemobile-styles');
          if(!s){s=document.createElement('style');s.id='vemobile-styles';document.head.appendChild(s);}
          s.textContent='$escapedCss';
        })();
      """);

      // 2. Inject main Vencord bundle
      final vemobileJs = await rootBundle.loadString('assets/vemobile.js');
      await _controller.runJavaScript(vemobileJs);

      debugPrint('[Vemobile] Bundle injected successfully');
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

  /// Show a dialog offering to open the native Discord app for calls
  void _showCallFallbackDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF2B2D31),
        title: const Text('Voice/Video Calls', style: TextStyle(color: Colors.white)),
        content: const Text(
          'WebRTC voice/video calls are not supported in this WebView.\n\n'
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
