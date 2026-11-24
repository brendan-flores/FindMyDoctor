import 'package:flutter/material.dart';

import '../core/navigation/app_navigator.dart';
import '../core/theme/app_colors.dart';

/// Branded animated splash page shown once during application startup.
///
/// Animation timeline (total ~3 seconds):
///   - fade the logo in over 1 second,
///   - keep it fully visible for 1.5 seconds,
///   - fade it out over 500 milliseconds,
///
/// then [onFinished] is called so [MyApp] can reveal the authenticated or
/// unauthenticated home screen.
///
/// The splash appears only during the first startup — never on later
/// navigation — and does not bypass login, registration, or session
/// restoration: [MyApp] hands off to the home screen only after both the
/// animation and app initialization have completed.
///
/// If initialization is still running when the animation ends, the logo
/// stays fully visible (the screen never goes blank) until the app is
/// ready, then fades out over 500 ms and transitions. With reduced motion
/// enabled the animation is skipped: the logo shows immediately and the
/// transition happens as soon as the app is ready.
class AnimatedSplashPage extends StatefulWidget {
  /// Completes when app initialization (session restore, auth checks) is
  /// finished.
  final Future<void> ready;

  /// Called once the animation has finished and the app is ready. The app
  /// should replace this page with its home screen.
  final VoidCallback onFinished;

  const AnimatedSplashPage({
    required this.ready,
    required this.onFinished,
    super.key,
  });

  @override
  State<AnimatedSplashPage> createState() => _AnimatedSplashPageState();
}

class _AnimatedSplashPageState extends State<AnimatedSplashPage>
    with SingleTickerProviderStateMixin {
  /// 1 s fade-in + 1.5 s hold + 0.5 s fade-out = ~3 s total.
  static const Duration _fadeIn = Duration(seconds: 1);
  static const Duration _fadeOut = Duration(milliseconds: 500);
  static const Duration _total = Duration(seconds: 3);

  /// Timeline position where the hold phase ends (2.5 s / 3 s).
  static const double _holdEnd = 2.5 / 3.0;

  /// Nominal timeline position: 0.0 at start, 1.0 after 3 s.
  late AnimationController _controller;

  bool _ready = false;
  bool _animationEnded = false;
  bool _transitioned = false;

  /// Whether the platform/user prefers reduced motion. Read during [build]
  /// rather than [initState] because it resolves [MediaQuery], which cannot be
  /// consulted before the first build completes.
  bool _skipAnimation = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: _total)
      ..addStatusListener(_onAnimationStatusChanged);

    widget.ready.then((_) {
      if (!mounted) return;
      setState(() => _ready = true);
      // If the animation already ran its course while waiting for the app to
      // become ready, run the 500 ms fade-out now (animateTo, not forward(),
      // so it takes exactly _fadeOut from the hold point, not the full 3 s).
      if (_animationEnded && !_transitioned) {
        _controller.animateTo(1.0, duration: _fadeOut, curve: Curves.easeOut);
      }
      _tryTransition();
    });

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onAnimationStatusChanged(AnimationStatus status) {
    if (!mounted) return;
    if (status == AnimationStatus.completed) {
      setState(() => _animationEnded = true);
      if (!_ready && !_transitioned) {
        // Pause in the hold phase so the logo stays visible instead of
        // showing a blank screen while startup finishes. Resuming from here
        // takes exactly 500 ms, giving a proper 500 ms fade-out once ready.
        _controller.value = _holdEnd;
      }
    }
    _tryTransition();
  }

  void _tryTransition() {
    if (_transitioned) return;
    final readyToLeave =
        _skipAnimation ? _ready : (_ready && _animationEnded);
    if (!readyToLeave) return;
    _transitioned = true;
    widget.onFinished();
  }

  /// Logo opacity over the nominal timeline:
  ///   [0, 1s)       ease-in   0 -> 1  (fade in)
  ///   [1s, 2.5s)                  1   (hold)
  ///   [2.5s, 3s]    ease-out  1 -> 0  (fade out)
  double get _logoOpacity {
    final t = _controller.value;
    final fadeInEnd = _fadeIn.inMilliseconds / _total.inMilliseconds;
    if (t <= fadeInEnd) {
      return Curves.easeIn.transform(t / fadeInEnd);
    }
    if (t < _holdEnd) {
      return 1.0;
    }
    return 1.0 -
        Curves.easeOut.transform((t - _holdEnd) / (1.0 - _holdEnd));
  }

  @override
  Widget build(BuildContext context) {
    // Read here (during build) rather than in initState: MediaQuery cannot be
    // consulted before initState completes.
    _skipAnimation = AppNavigator.isReducedMotion(context);

    return Scaffold(
      // Identical to the native launch background so the hand-off is seamless.
      backgroundColor: AppColors.surfaceLowest,
      body: Center(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Opacity(
              opacity: _skipAnimation ? 1.0 : _logoOpacity,
              child: child,
            );
          },
          child: SizedBox(
            width: 320,
            height: 320,
            child: Center(
              child: Image.asset(
                'assets/images/findmydoctor_logo.png',
                width: 300,
                height: 100,
                fit: BoxFit.contain,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
