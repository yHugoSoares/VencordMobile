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
    // Wire back navigation requests from JS (Discord SPA popstate)
    _jsBridge.onNavigateBack = () => _goBack();
    _controller = _createWebView();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Handle system back button: delegate to WebView first, then minimize app.
  Future<void> _onWillPop() async {
    try {
      final canGo = await _controller.canGoBack();
      if (canGo) {
        _controller.goBack();
        // Also update JS back button state after navigation
        Future.delayed(const Duration(milliseconds: 300), _updateJsBackState);
        return;
      }
    } catch (_) {}
    // Nothing to go back to — minimize app
    SystemNavigator.pop();
  }

  /// Go back in WebView history, with JS fallback for SPAs.
  Future<void> _goBack() async {
    try {
      // Try browser history first
      final canGo = await _controller.canGoBack();
      if (canGo) {
        _controller.goBack();
      } else {
        // Fallback: tell Discord SPA to go home
        _controller.runJavaScript("history.back()");
      }
    } catch (_) {}
  }

  WebViewController _createWebView() {
    final ctrl = WebViewController();
    ctrl.setJavaScriptMode(JavaScriptMode.unrestricted);
    ctrl.setBackgroundColor(const Color(0xFF202225));

    // Mobile Android Chrome user-agent → Discord serves responsive mobile web app
    ctrl.setUserAgent(
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 '
      'Vemobile/0.4.0',
    );

    ctrl.setNavigationDelegate(
      NavigationDelegate(
        onPageStarted: (_) {
          if (mounted) setState(() => _isLoading = true);
        },
        onPageFinished: (_) async {
          if (mounted) setState(() => _isLoading = false);
          _injectVencordBundle();
          // Notify JS of the current canGoBack state
          _updateJsBackState();
        },
        onWebResourceError: (error) {
          debugPrint('[Vemobile] Web error: ${error.description}');
        },
        onNavigationRequest: (request) {
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

          // Allow auth/captcha providers
          if (uri.host.endsWith('hcaptcha.com') ||
              uri.host.endsWith('recaptcha.net') ||
              uri.host == 'www.google.com' ||
              uri.host.endsWith('.google.com') ||
              uri.host.endsWith('cloudflare.com') ||
              uri.host.endsWith('stripe.com') ||
              uri.host.endsWith('paypal.com')) {
            return NavigationDecision.navigate;
          }

          _openExternalUrl(request.url);
          return NavigationDecision.prevent;
        },
      ),
    );

    ctrl.addJavaScriptChannel(
      'VemobileBridge',
      onMessageReceived: (message) => _jsBridge.handleJsMessage(ctrl, message.message),
    );

    ctrl.loadRequest(Uri.parse('https://discord.com/app'));
    return ctrl;
  }

  /// Tell the JS layer whether the WebView can go back (for showing/hiding back button)
  Future<void> _updateJsBackState() async {
    try {
      final canGo = await _controller.canGoBack();
      _controller.runJavaScript(
        "window.__VEMOBILE__ && window.__VEMOBILE__._updateBackState && "
        "window.__VEMOBILE__._updateBackState($canGo)",
      );
    } catch (_) {}
  }

  Future<void> _injectVencordBundle() async {
    if (_vencordInjected) return;
    _vencordInjected = true;

    // Inject CSS early at DOMContentLoaded so Vencord styles load before Discord paints
    try {
      final css = await rootBundle.loadString('assets/vemobile.css');
      final escaped = css
          .replaceAll('\\', '\\\\').replaceAll("'", "\\'")
          .replaceAll('\n', '\\n').replaceAll('\r', '');
      await _controller.runJavaScript("""
        (function(){
          var s=document.getElementById('vemobile-vc-css');
          if(!s){s=document.createElement('style');s.id='vemobile-vc-css';
          (document.head||document.documentElement).appendChild(s);}
          s.textContent='$escaped';
        })();
      """);
    } catch (e) {
      debugPrint('[Vemobile] CSS injection failed: $e');
    }

    try {
      final js = await rootBundle.loadString('assets/vemobile.js');
      await _controller.runJavaScript(js);
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
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) await _onWillPop();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF202225),
        body: SafeArea(
          top: true,   // Protect top from status bar / notch
          bottom: false, // We handle bottom with CSS nav bar
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
      ),
    );
  }
}
