import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

/// Builds a minimal app with a button that opens the requested dialog and
/// records the resolved value.
Widget _harness({
  required Future<void> Function(BuildContext context) openDialog,
}) {
  return MaterialApp(
    home: Scaffold(
      body: Builder(
        builder: (context) => ElevatedButton(
          onPressed: () async {
            await openDialog(context);
          },
          child: const Text('open'),
        ),
      ),
    ),
  );
}

void main() {
  group('AppDialogs.showConfirm', () {
    testWidgets('shows title, message, and both actions', (tester) async {
      await tester.pumpWidget(
        _harness(
          openDialog: (context) => AppDialogs.showConfirm(
            context: context,
            title: 'Delete conversation',
            message: 'This action cannot be undone.',
            confirmLabel: 'Delete',
          ).then((_) {}),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      expect(find.text('Delete conversation'), findsOneWidget);
      expect(find.text('This action cannot be undone.'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
      expect(find.text('Delete'), findsOneWidget);
    });

    testWidgets('resolves true when the confirm action is tapped',
        (tester) async {
      bool? result;
      await tester.pumpWidget(
        _harness(
          openDialog: (context) async {
            result = await AppDialogs.showConfirm(
              context: context,
              title: 'Sure?',
              message: 'Really?',
              confirmLabel: 'Yes',
            );
          },
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Yes'));
      await tester.pumpAndSettle();

      expect(result, isTrue);
      expect(find.text('Sure?'), findsNothing);
    });

    testWidgets('resolves false when cancel is tapped', (tester) async {
      bool? result;
      await tester.pumpWidget(
        _harness(
          openDialog: (context) async {
            result = await AppDialogs.showConfirm(
              context: context,
              title: 'Sure?',
              message: 'Really?',
            );
          },
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(result, isFalse);
    });

    testWidgets('resolves false on barrier dismissal', (tester) async {
      bool? result;
      await tester.pumpWidget(
        _harness(
          openDialog: (context) async {
            result = await AppDialogs.showConfirm(
              context: context,
              title: 'Sure?',
              message: 'Really?',
            );
          },
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();

      expect(result, isFalse);
    });

    testWidgets('uses the error color for the danger tone', (tester) async {
      await tester.pumpWidget(
        _harness(
          openDialog: (context) => AppDialogs.showConfirm(
            context: context,
            title: 'Logout',
            message: 'Are you sure?',
            confirmLabel: 'Logout',
            tone: AppDialogTone.danger,
          ).then((_) {}),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      final confirmButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Logout'),
      );
      final foreground = confirmButton.style?.foregroundColor?.resolve(
        const <WidgetState>{},
      );
      expect(foreground, AppColors.error);
    });

    testWidgets('uses the primary color for the default tone', (tester) async {
      await tester.pumpWidget(
        _harness(
          openDialog: (context) => AppDialogs.showConfirm(
            context: context,
            title: 'Join?',
            message: 'Join now?',
            confirmLabel: 'Join',
          ).then((_) {}),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      final confirmButton = tester.widget<TextButton>(
        find.widgetWithText(TextButton, 'Join'),
      );
      final foreground = confirmButton.style?.foregroundColor?.resolve(
        const <WidgetState>{},
      );
      expect(foreground, AppColors.primary);
    });
  });

  group('AppDialogs.showInfo', () {
    testWidgets('shows a single acknowledge action', (tester) async {
      await tester.pumpWidget(
        _harness(
          openDialog: (context) => AppDialogs.showInfo(
            context: context,
            title: 'Notice',
            message: 'Please read this.',
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      expect(find.text('Notice'), findsOneWidget);
      expect(find.text('Please read this.'), findsOneWidget);
      expect(find.text('OK'), findsOneWidget);
      expect(find.text('Cancel'), findsNothing);
    });

    testWidgets('dismisses when OK is tapped', (tester) async {
      var dismissed = false;
      await tester.pumpWidget(
        _harness(
          openDialog: (context) async {
            await AppDialogs.showInfo(
              context: context,
              title: 'Notice',
              message: 'Please read this.',
            );
            dismissed = true;
          },
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      expect(dismissed, isTrue);
      expect(find.text('Notice'), findsNothing);
    });
  });
}
