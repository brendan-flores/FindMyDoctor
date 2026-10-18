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
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final Iterable<String>? autofillHints;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String?)? onSubmitted;
  final bool enabled;
  final bool readOnly;
  final VoidCallback? onTap;
  final int? maxLines;
  final int? maxLength;
  final FocusNode? focusNode;
  final TextCapitalization textCapitalization;

  /// Optional override for the field's corner radius.
  /// Defaults to [spacing.AppSpacing.radiusLg] to preserve existing behaviour.
  final double? borderRadius;

  const CustomTextField({
    super.key,
    this.label,
    this.hint,
    this.initialValue,
    this.controller,
    this.obscureText = false,
    this.enablePasswordToggle = false,
    this.keyboardType,
    this.textInputAction,
    this.inputFormatters,
    this.autofillHints,
    this.prefixIcon,
    this.suffixIcon,
    this.validator,
    this.onChanged,
    this.onSubmitted,
    this.enabled = true,
    this.readOnly = false,
    this.onTap,
    this.maxLines = 1,
    this.maxLength,
    this.focusNode,
    this.textCapitalization = TextCapitalization.none,
    this.borderRadius,
  });

  @override
  State<CustomTextField> createState() => _CustomTextFieldState();
}

class _CustomTextFieldState extends State<CustomTextField> {
  late bool _obscureText;
  late FocusNode _focusNode;
  late bool _ownsFocusNode;
  bool _hasFocus = false;

  double get _radius => widget.borderRadius ?? spacing.AppSpacing.radiusLg;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.obscureText;
    _ownsFocusNode = widget.focusNode == null;
    _focusNode = widget.focusNode ?? FocusNode();
    _focusNode.addListener(_handleFocusChange);
  }

  @override
  void dispose() {
    _focusNode.removeListener(_handleFocusChange);
    if (_ownsFocusNode) {
      _focusNode.dispose();
    }
    super.dispose();
  }

  void _handleFocusChange() {
    if (!mounted) return;
    setState(() {
      _hasFocus = _focusNode.hasFocus;
    });
  }

  void _togglePasswordVisibility() {
    setState(() {
      _obscureText = !_obscureText;
    });
  }

  OutlineInputBorder _border(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(_radius),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bool showFocusAccent = _hasFocus && widget.enabled;

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
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(_radius),
            boxShadow: showFocusAccent
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : const [],
          ),
          child: TextFormField(
            controller: widget.controller,
            initialValue: widget.initialValue,
            obscureText: _obscureText,
            keyboardType: widget.keyboardType,
            textInputAction: widget.textInputAction,
            inputFormatters: widget.inputFormatters,
            autofillHints: widget.autofillHints,
            validator: widget.validator,
            onChanged: widget.onChanged,
            onFieldSubmitted: widget.onSubmitted,
            enabled: widget.enabled,
            readOnly: widget.readOnly,
            onTap: widget.onTap,
            maxLines: widget.maxLines,
            maxLength: widget.maxLength,
            focusNode: _focusNode,
            textCapitalization: widget.textCapitalization,
            style: AppTextStyles.inputText,
            decoration: InputDecoration(
              hintText: widget.hint,
              hintStyle: AppTextStyles.inputPlaceholder,
              filled: true,
              fillColor: AppColors.surfaceLowest,
              contentPadding: EdgeInsets.symmetric(
                horizontal: widget.prefixIcon != null
                    ? spacing.AppSpacing.gutterXl + spacing.AppSpacing.gutterSm
                    : spacing.AppSpacing.gutterLg,
                vertical: spacing.AppSpacing.gutterMd,
              ),
              prefixIcon: widget.prefixIcon != null
                  ? Icon(
                      widget.prefixIcon,
                      color: showFocusAccent
                          ? AppColors.primary
                          : AppColors.slate400,
                      size: spacing.AppSpacing.iconMd,
                    )
                  : null,
              suffixIcon: widget.enablePasswordToggle
                  ? IconButton(
                      icon: Icon(
                        _obscureText ? Icons.visibility_off : Icons.visibility,
                        color: _hasFocus
                            ? AppColors.primary
                            : AppColors.slate400,
                        size: spacing.AppSpacing.iconMd,
                      ),
                      tooltip: _obscureText
                          ? 'Show password'
                          : 'Hide password',
                      onPressed: _togglePasswordVisibility,
                    )
                  : widget.suffixIcon,
              border: _border(AppColors.slate300),
              enabledBorder: _border(AppColors.slate300),
              disabledBorder: _border(AppColors.slate200),
              focusedBorder: _border(AppColors.primary, width: 2),
              errorBorder: _border(AppColors.error),
              focusedErrorBorder: _border(AppColors.error, width: 2),
              counterText: widget.maxLength != null ? '' : null,
            ),
          ),
        ),
      ],
    );
  }
}
