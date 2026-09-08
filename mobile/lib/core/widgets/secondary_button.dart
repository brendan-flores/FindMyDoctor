import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import '../theme/app_text_styles.dart';

class SecondaryButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final Widget? icon;
  final double? height;

  const SecondaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.height,
  });

  @override
  Widget build(BuildContext context) {
    final buttonHeight = height ?? spacing.AppSpacing.buttonHeight;

    if (isFullWidth) {
      return SizedBox(
        width: double.infinity,
        height: buttonHeight,
        child: _buildButton(),
      );
    }

    return SizedBox(
      height: buttonHeight,
      child: _buildButton(),
    );
  }

  Widget _buildButton() {
    return OutlinedButton(
      onPressed: isLoading ? null : onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary,
        side: BorderSide(color: AppColors.primary, width: 1.5),
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterLg,
          vertical: spacing.AppSpacing.gutterMd,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        ),
        textStyle: AppTextStyles.buttonLabel,
      ),
      child: isLoading
          ? SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  icon!,
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                ],
                Text(text),
              ],
            ),
    );
  }
}
