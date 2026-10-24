import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_text_styles.dart';

class OtpInput extends StatefulWidget {
  final int length;
  final Function(String) onChanged;
  final Function(String)? onCompleted;
  final bool enabled;
  final String? errorMessage;

  const OtpInput({
    super.key,
    this.length = 6,
    required this.onChanged,
    this.onCompleted,
    this.enabled = true,
    this.errorMessage,
  });

  @override
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;
  int? _focusedIndex;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(
      widget.length,
      (index) => TextEditingController(),
    );
    _focusNodes = List.generate(
      widget.length,
      (index) => FocusNode(),
    );

    for (var controller in _controllers) {
      controller.addListener(_onOTPChanged);
    }
    for (var node in _focusNodes) {
      node.addListener(_handleFocusChange);
    }

    Future.delayed(const Duration(milliseconds: 100), () {
      if (mounted) {
        _focusNodes[0].requestFocus();
      }
    });
  }

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.removeListener(_onOTPChanged);
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.removeListener(_handleFocusChange);
      node.dispose();
    }
    super.dispose();
  }

  void _onOTPChanged() {
    final otp = _controllers.map((c) => c.text).join();
    widget.onChanged(otp);
    if (otp.length == widget.length && widget.onCompleted != null) {
      widget.onCompleted!(otp);
    }
  }

  void _handleFocusChange() {
    if (!mounted) return;
    final int index = _focusNodes.indexWhere((node) => node.hasFocus);
    setState(() {
      _focusedIndex = index == -1 ? null : index;
    });
  }

  void _handleOTPChange(int index, String value) {
    setState(() {});
    if (value.isNotEmpty && index < widget.length - 1) {
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  void _handleOTPPaste() {
    Clipboard.getData(Clipboard.kTextPlain).then((clipboardData) {
      if (clipboardData != null && clipboardData.text != null) {
        final pastedText = clipboardData.text!.trim();
        if (pastedText.length == widget.length && RegExp(r'^\d+$').hasMatch(pastedText)) {
          for (int i = 0; i < widget.length; i++) {
            _controllers[i].text = pastedText[i];
          }
          _focusNodes[widget.length - 1].requestFocus();
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleOTPPaste,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double maxWidth = constraints.maxWidth;
          final double gap = maxWidth < 300 ? AppSpacing.gutterXs : AppSpacing.gutterSm;
          double boxSize = math.max(0.0, (maxWidth - gap * (widget.length - 1)) / widget.length);
          if (boxSize > 56) boxSize = 56;

          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.length, (index) {
              return Padding(
                padding: EdgeInsets.only(
                  right: index == widget.length - 1 ? 0 : gap,
                ),
                child: _buildOTPBox(index, boxSize),
              );
            }),
          );
        },
      ),
    );
  }

  Widget _buildOTPBox(int index, double size) {
    final controller = _controllers[index];
    final bool isFocused = _focusedIndex == index;
    final bool hasValue = controller.text.isNotEmpty;
    final bool hasError = widget.errorMessage != null;

    final Color borderColor;
    final Color fillColor;
    final double borderWidth;

    if (hasError) {
      borderColor = AppColors.error;
      fillColor = AppColors.errorContainer.withValues(alpha: 0.35);
      borderWidth = isFocused ? 2 : 1.4;
    } else if (isFocused) {
      borderColor = AppColors.brandPrimary;
      fillColor = AppColors.surfaceLowest;
      borderWidth = 2;
    } else if (hasValue) {
      borderColor = AppColors.brandPrimary.withValues(alpha: 0.45);
      fillColor = AppColors.brandPrimary.withValues(alpha: 0.05);
      borderWidth = 1.4;
    } else {
      borderColor = AppColors.slate300;
      fillColor = AppColors.surfaceLowest;
      borderWidth = 1.4;
    }

    final double fontSize = (size * 0.5).clamp(18.0, 24.0);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: borderColor,
          width: borderWidth,
        ),
      ),
      child: TextField(
        controller: controller,
        focusNode: _focusNodes[index],
        enabled: widget.enabled,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        style: AppTextStyles.headlineLg.copyWith(
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          color: AppColors.brandNavy,
          letterSpacing: 0,
        ),
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(1),
        ],
        decoration: const InputDecoration(
          border: InputBorder.none,
          contentPadding: EdgeInsets.zero,
          counterText: '',
        ),
        onChanged: (value) => _handleOTPChange(index, value),
      ),
    );
  }
}
