import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/auth/presentation/login_page.dart';
import 'package:mobile/features/auth/presentation/signup_page.dart';
import 'package:mobile/features/home/presentation/home_page.dart';

/// Regression coverage for the "Each child must be laid out exactly once."
/// crash.
///
/// On Android the very first frame is laid out against a zero-sized viewport
/// (`D/FlutterRenderer: Width is zero. 0,0`). Screens that derived a size by
/// subtracting a constant from that dynamic height produced an invalid
/// negative constraint, the body failed to build, and the Scaffold's
/// multi-child layout then reported a forgotten `RenderErrorBox` child — which
/// also left the screen stuck until a rebuild/hot restart.
///
/// These tests drive the zero -> real viewport transition and assert the two
/// failure modes are gone. Unrelated `RenderFlex` overflow messages are ignored
/// because the test font has different metrics from the bundled app font.
Future<List<String>> _layoutErrorSummaries(
  WidgetTester tester,
  Widget child,
) async {
  final summaries = <String>[];
  final previous = FlutterError.onError;
  FlutterError.onError = (details) => summaries.add(details.summary.toString());
  addTearDown(() => FlutterError.onError = previous);

  tester.view.physicalSize = const Size(1, 1);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(MaterialApp(home: child));
  await tester.pump();

  // Android grows the viewport right after the zero-sized first frame.
  tester.view.physicalSize = const Size(400, 800);
  for (var i = 0; i < 6; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }

  return summaries;
}

void _expectNoFatalLayoutErrors(List<String> summaries) {
  expect(
    summaries.where((s) => s.contains('negative minimum height')),
    isEmpty,
    reason: 'The zero-sized first frame must not create invalid constraints.\n'
        'Captured: $summaries',
  );
  expect(
    summaries.where((s) => s.contains('laid out exactly once')),
    isEmpty,
    reason: 'Multi-child layout must stay consistent.\nCaptured: $summaries',
  );
}

void main() {
  testWidgets('login page survives the zero-sized first frame',
      (tester) async {
    final summaries = await _layoutErrorSummaries(tester, const LoginPage());
    _expectNoFatalLayoutErrors(summaries);
  });

  testWidgets('sign up page survives the zero-sized first frame',
      (tester) async {
    final summaries = await _layoutErrorSummaries(tester, const SignUpPage());
    _expectNoFatalLayoutErrors(summaries);
  });

  testWidgets('home page survives the zero-sized first frame',
      (tester) async {
    final summaries = await _layoutErrorSummaries(tester, const HomePage());
    _expectNoFatalLayoutErrors(summaries);
  });
}
