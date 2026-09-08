import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_text_styles.dart';

class PrimaryButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isFullWidth;
  final Widget? icon;
  final double? height;
  final Color? backgroundColor;
  final Color? textColor;

  const PrimaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isFullWidth = true,
    this.icon,
    this.height,
    this.backgroundColor,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    final buttonHeight = height ?? AppSpacing.buttonHeightLarge;
    final bgColor = backgroundColor ?? AppColors.primary;
    final txtColor = textColor ?? AppColors.onPrimary;

    if (isFullWidth) {
      return SizedBox(
        width: double.infinity,
        height: buttonHeight,
        child: _buildButton(bgColor, txtColor),
      );
    }

    return SizedBox(
      height: buttonHeight,
      child: _buildButton(bgColor, txtColor),
    );
  }

  Widget _buildButton(Color bgColor, Color txtColor) {
    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: bgColor,
        foregroundColor: txtColor,
        elevation: AppSpacing.elevation2,
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.gutterLg,
          vertical: AppSpacing.gutterMd,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
        textStyle: AppTextStyles.buttonLabel,
      ),
      child: isLoading
          ? SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(txtColor),
              ),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  icon!,
                  const SizedBox(width: AppSpacing.gutterSm),
                ],
                Text(text),
              ],
            ),
    );
  }
}
