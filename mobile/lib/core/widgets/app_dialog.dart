import 'package:flutter/material.dart';

import '../navigation/app_navigator.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import '../theme/app_text_styles.dart';

/// Visual tone for the confirm action of [AppConfirmDialog].
///
/// - [primary]: everyday confirmations (join a waitlist, reschedule).
/// - [danger]: irreversible or account-impacting actions (cancel an
///   appointment, delete a conversation, log out).
enum AppDialogTone { primary, danger }

/// Reusable confirmation dialog for simple yes/no decisions.
///
/// Pops `true` when the confirm action is tapped and `false` for cancel or
/// barrier dismissal. Use [AppDialogs.showConfirm] to display it through
/// [AppNavigator.showAppDialog] so the app's dialog transition and
/// reduced-motion behavior are preserved.
class AppConfirmDialog extends StatelessWidget {
  const AppConfirmDialog({
    super.key,
    required this.title,
    required this.message,
    this.confirmLabel = 'Confirm',
    this.cancelLabel = 'Cancel',
    this.tone = AppDialogTone.primary,
  });

  final String title;
  final String message;
  final String confirmLabel;
  final String cancelLabel;
  final AppDialogTone tone;

  @override
  Widget build(BuildContext context) {
    final confirmColor =
        tone == AppDialogTone.danger ? AppColors.error : AppColors.primary;

    return AlertDialog(
      backgroundColor: AppColors.surfaceLowest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radius2xl),
      ),
      title: Text(title, style: AppTextStyles.headlineSm),
      content: Text(
        message,
        style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(cancelLabel),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: TextButton.styleFrom(foregroundColor: confirmColor),
          child: Text(confirmLabel),
        ),
      ],
    );
  }
}

/// Reusable information dialog for messages the user must acknowledge.
///
/// Shows a single OK action and resolves once dismissed. Use
/// [AppDialogs.showInfo] to display it through
/// [AppNavigator.showAppDialog].
class AppInfoDialog extends StatelessWidget {
  const AppInfoDialog({
    super.key,
    required this.title,
    required this.message,
    this.confirmLabel = 'OK',
  });

  final String title;
  final String message;
  final String confirmLabel;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surfaceLowest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radius2xl),
      ),
      title: Text(title, style: AppTextStyles.headlineSm),
      content: Text(
        message,
        style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(confirmLabel),
        ),
      ],
    );
  }
}

/// Entry points for the app's reusable confirmation/information dialogs.
///
/// Both helpers route through [AppNavigator.showAppDialog], so they inherit
/// the shared dialog transition timing and reduced-motion handling.
class AppDialogs {
  AppDialogs._();

  /// Shows a confirmation dialog and resolves `true` only when the user
  /// taps the confirm action. Cancel, barrier dismissal, and back
  /// navigation all resolve `false`.
  static Future<bool> showConfirm({
    required BuildContext context,
    required String title,
    required String message,
    String confirmLabel = 'Confirm',
    String cancelLabel = 'Cancel',
    AppDialogTone tone = AppDialogTone.primary,
    bool barrierDismissible = true,
  }) async {
    final result = await AppNavigator.showAppDialog<bool>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (dialogContext) => AppConfirmDialog(
        title: title,
        message: message,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
        tone: tone,
      ),
    );
    return result ?? false;
  }

  /// Shows an information dialog with a single acknowledge action.
  static Future<void> showInfo({
    required BuildContext context,
    required String title,
    required String message,
    String confirmLabel = 'OK',
    bool barrierDismissible = true,
  }) {
    return AppNavigator.showAppDialog<void>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (dialogContext) => AppInfoDialog(
        title: title,
        message: message,
        confirmLabel: confirmLabel,
      ),
    );
  }
}
