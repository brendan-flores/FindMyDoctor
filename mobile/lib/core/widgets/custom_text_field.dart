import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import '../theme/app_text_styles.dart';

class CustomTextField extends StatefulWidget {
  final String? label;
  final String? hint;
  final String? initialValue;
  final TextEditingController? controller;
  final bool obscureText;
  final bool enablePasswordToggle;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String?)? onSubmitted;
  final bool enabled;
  final int? maxLines;
  final int? maxLength;
  final FocusNode? focusNode;
  final TextCapitalization textCapitalization;

  const CustomTextField({
    super.key,
    this.label,
    this.hint,
    this.initialValue,
    this.controller,
    this.obscureText = false,
    this.enablePasswordToggle = false,
    this.keyboardType,
    this.inputFormatters,
    this.prefixIcon,
    this.suffixIcon,
    this.validator,
    this.onChanged,
    this.onSubmitted,
    this.enabled = true,
    this.maxLines = 1,
    this.maxLength,
    this.focusNode,
    this.textCapitalization = TextCapitalization.none,
  });

  @override
  State<CustomTextField> createState() => _CustomTextFieldState();
}

class _CustomTextFieldState extends State<CustomTextField> {
  late bool _obscureText;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.obscureText;
  }

  void _togglePasswordVisibility() {
    setState(() {
      _obscureText = !_obscureText;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: AppTextStyles.inputLabel,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
        ],
        TextFormField(
          controller: widget.controller,
          initialValue: widget.initialValue,
          obscureText: _obscureText,
          keyboardType: widget.keyboardType,
          inputFormatters: widget.inputFormatters,
          validator: widget.validator,
          onChanged: widget.onChanged,
          onFieldSubmitted: widget.onSubmitted,
          enabled: widget.enabled,
          maxLines: widget.maxLines,
          maxLength: widget.maxLength,
          focusNode: widget.focusNode,
          textCapitalization: widget.textCapitalization,
          style: AppTextStyles.inputText,
          decoration: InputDecoration(
            hintText: widget.hint,
            hintStyle: AppTextStyles.inputPlaceholder,
            filled: true,
            fillColor: AppColors.surfaceLowest,
            contentPadding: EdgeInsets.symmetric(
              horizontal: widget.prefixIcon != null ? spacing.AppSpacing.gutterXl + spacing.AppSpacing.gutterSm : spacing.AppSpacing.gutterLg,
              vertical: spacing.AppSpacing.gutterMd,
            ),
            prefixIcon: widget.prefixIcon != null
                ? Icon(
                    widget.prefixIcon,
                    color: AppColors.slate400,
                    size: spacing.AppSpacing.iconMd,
                  )
                : null,
            suffixIcon: widget.enablePasswordToggle
                ? IconButton(
                    icon: Icon(
                      _obscureText ? Icons.visibility_off : Icons.visibility,
                      color: AppColors.slate400,
                      size: spacing.AppSpacing.iconMd,
                    ),
                    onPressed: _togglePasswordVisibility,
                  )
                : widget.suffixIcon,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
              borderSide: BorderSide(color: AppColors.slate300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
              borderSide: BorderSide(color: AppColors.slate300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
              borderSide: BorderSide(color: AppColors.primary, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
              borderSide: BorderSide(color: AppColors.error),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
              borderSide: BorderSide(color: AppColors.error, width: 2),
            ),
            counterText: widget.maxLength != null ? '' : null,
          ),
        ),
      ],
    );
  }
}
