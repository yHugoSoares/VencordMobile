import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'js_bridge.dart';

class WebViewShell extends StatefulWidget {
  const WebViewShell({super.key});

  @override
  State<WebViewShell> createState() => _WebViewShellState();
}

class _WebViewShellState extends State<WebViewShell> with WidgetsBindingObserver {
  late WebViewController _controller;
  bool _isLoading = true;
  bool _vencordInjected = false;
  final JsBridge _jsBridge = JsBridge();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // App went to background — notify Vencord
      _jsBridge.sendToJs(_controller, 'lifecycle', {'state': 'paused'});
    } else if (state == AppLifecycleState.resumed) {
      _jsBridge.sendToJs(_controller, 'lifecycle', {'state': 'resumed'});
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
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

  void _createWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF202225))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) {
            setState(() => _isLoading = true);
          },
          onPageFinished: (url) {
            setState(() => _isLoading = false);
            _injectVencordBundle();
          },
          onWebResourceError: (error) {
            debugPrint('[Vemobile] Web resource error: ${error.description}');
          },
          onNavigationRequest: (request) {
            final url = request.url.toLowerCase();
            // Allow Discord.com
            if (url.contains('discord.com')) {
              return NavigationDecision.navigate;
            }
            // Allow Discord CDN and API
            if (url.contains('discordapp.com') ||
                url.contains('discordapp.net') ||
                url.contains('discord.gg') ||
                url.contains('discord.media') ||
                url.contains('discordcdn.com')) {
              return NavigationDecision.navigate;
            }
            // Block external links — they should open in native browser
            if (!url.contains('discord.com/app')) {
              _jsBridge.handleOpenUrl({'url': request.url});
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..addJavaScriptChannel(
        'VemobileBridge',
        onMessageReceived: (JavaScriptMessage message) {
          _jsBridge.handleJsMessage(message.message);
        },
      );

    // Set user agent to avoid Discord's mobile app redirect
    _controller.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/131.0.0.0 Safari/537.36 '
      'Vemobile/0.1.0',
    );

    // Load Discord web app
    _controller.loadRequest(
      Uri.parse('https://discord.com/app'),
    );
  }

  Future<void> _injectVencordBundle() async {
    if (_vencordInjected) return;
    _vencordInjected = true;

    try {
      // Load the Vencord bundle from assets
      final vemobileJs = await rootBundle.loadString('assets/vemobile.js');
      await _controller.runJavaScript(vemobileJs);

      // Load the Vencord CSS
      final vemobileCss = await rootBundle.loadString('assets/vemobile.css');
      final escapedCss = vemobileCss
          .replaceAll('\\', '\\\\')
          .replaceAll("'", "\\'")
          .replaceAll('\n', '\\n')
          .replaceAll('\r', '');
      await _controller.runJavaScript("""
        (function() {
          var style = document.createElement('style');
          style.id = 'vemobile-styles';
          style.textContent = '$escapedCss';
          document.head.appendChild(style);
        })();
      """);

      debugPrint('[Vemobile] Bundle injected successfully');
    } catch (e) {
      debugPrint('[Vemobile] Failed to inject bundle: $e');
      _vencordInjected = false;
    }
  }

  void _reload() {
    setState(() {
      _isLoading = true;
      _vencordInjected = false;
    });
    _controller.reload();
  }
}
