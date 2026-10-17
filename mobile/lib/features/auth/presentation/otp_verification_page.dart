import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';
import 'successful_registration_page.dart';

class OTPVerificationPage extends StatefulWidget {
  final String email;
  final String? firstName;
  final String? lastName;
  final String? username;
  final String? password;

  const OTPVerificationPage({
    super.key,
    required this.email,
    this.firstName,
    this.lastName,
    this.username,
    this.password,
  });

  @override
  State<OTPVerificationPage> createState() => _OTPVerificationPageState();
}

class _OTPVerificationPageState extends State<OTPVerificationPage> {
  final List<TextEditingController> _otpControllers = List.generate(
    6,
    (index) => TextEditingController(),
  );
  final List<FocusNode> _focusNodes = List.generate(
    6,
    (index) => FocusNode(),
  );

  bool _isLoading = false;
  int _resendCountdown = 30;
  bool _canResend = false;
  String? _errorMessage;

  // Index of the currently focused OTP box (null when none is focused).
  int? _focusedIndex;

  final ApiService _apiService = ApiService();

  @override
  void initState() {
    super.initState();
    _startResendTimer();
    // Add listeners to OTP controllers
    for (var controller in _otpControllers) {
      controller.addListener(_onOTPChanged);
    }
    // Track focus so each box can render its focused state.
    for (var node in _focusNodes) {
      node.addListener(_handleFocusChange);
    }
    // Auto-focus the first OTP field
    Future.delayed(const Duration(milliseconds: 100), () {
      _focusNodes[0].requestFocus();
    });
  }

  @override
  void dispose() {
    for (var controller in _otpControllers) {
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
    // Clear error message when user starts typing
    if (_errorMessage != null) {
      setState(() {
        _errorMessage = null;
      });
    }
  }

  void _handleFocusChange() {
    if (!mounted) return;
    final int index = _focusNodes.indexWhere((node) => node.hasFocus);
    setState(() {
      _focusedIndex = index == -1 ? null : index;
    });
  }

  void _startResendTimer() {
    setState(() {
      _resendCountdown = 30;
      _canResend = false;
    });

    Future.doWhile(() async {
      await Future.delayed(const Duration(seconds: 1));
      if (!mounted) return false;

      setState(() {
        _resendCountdown--;
      });

      if (_resendCountdown <= 0) {
        setState(() {
          _canResend = true;
        });
        return false;
      }

      return true;
    });
  }

  void _handleOTPChange(int index, String value) {
    setState(() {
      // Trigger rebuild to update button state
    });
    if (value.isNotEmpty && index < 5) {
      // Move to next field
      _focusNodes[index + 1].requestFocus();
    } else if (value.isEmpty && index > 0) {
      // Move to previous field
      _focusNodes[index - 1].requestFocus();
    }
  }

  void _handleOTPPaste() {
    // Get clipboard data
    Clipboard.getData(Clipboard.kTextPlain).then((clipboardData) {
      if (clipboardData != null && clipboardData.text != null) {
        final pastedText = clipboardData.text!.trim();
        if (pastedText.length == 6 && RegExp(r'^\d{6}$').hasMatch(pastedText)) {
          // Fill all OTP fields
          for (int i = 0; i < 6; i++) {
            _otpControllers[i].text = pastedText[i];
          }
          // Focus the last field
          _focusNodes[5].requestFocus();
        }
      }
    });
  }

  String get _otpCode {
    return _otpControllers.map((controller) => controller.text).join();
  }

  bool get _isOTPValid {
    return _otpCode.length == 6 && RegExp(r'^\d{6}$').hasMatch(_otpCode);
  }

  Future<void> _handleVerify() async {
    if (!_isOTPValid) {
      setState(() {
        _errorMessage = 'Please enter a valid 6-digit OTP code';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Call the backend API to verify OTP and create patient account
      final response = await _apiService.verifyPatientOtp(
        email: widget.email,
        otp: _otpCode,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        if (response['success'] == true) {
          // Save the access token if returned
          if (response['data'] != null && response['data']['accessToken'] != null) {
            await _apiService.saveToken(response['data']['accessToken']);
          }

          // Clear onboarding completion flag for new users
          final prefs = await SharedPreferences.getInstance();
          await prefs.setBool('has_completed_onboarding', false);

          if (mounted) {
            // Show success message
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Email verified successfully! Account created.'),
                backgroundColor: AppColors.medicalTeal,
              ),
            );

            // Navigate to successful registration page
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (context) => const SuccessfulRegistrationPage(),
              ),
            );
          }
        } else {
          setState(() {
            _errorMessage = response['error']?['message'] ?? 'Invalid or expired OTP code';
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        String errorMessage = 'Verification failed. Please try again.';
        String errorString = e.toString();
        
        if (errorString.contains('Connection refused') || errorString.contains('Failed host lookup')) {
          errorMessage = 'Cannot connect to server. Please ensure backend is running';
        } else if (errorString.contains('timeout')) {
          errorMessage = 'Request timed out. Please check your connection.';
        } else if (errorString.contains('400')) {
          errorMessage = 'Invalid or expired OTP code';
        } else if (errorString.contains('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (errorString.length < 100) {
          errorMessage = errorString;
        }

        setState(() {
          _errorMessage = errorMessage;
        });
      }
    }
  }

  Future<void> _handleResendOTP() async {
    if (!_canResend) return;

    setState(() {
      _isLoading = true;
    });

    try {
      // Call the backend API to resend OTP
      final response = await _apiService.resendPatientOtp(
        email: widget.email,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        if (response['success'] == true) {
          // Reset timer
          _startResendTimer();

          // Clear OTP fields
          for (var controller in _otpControllers) {
            controller.clear();
          }
          _focusNodes[0].requestFocus();

          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('OTP sent successfully!'),
              backgroundColor: AppColors.medicalTeal,
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['error']?['message'] ?? 'Failed to resend OTP'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        String errorMessage = 'Failed to resend OTP. Please try again.';
        String errorString = e.toString();
        
        if (errorString.contains('Connection refused') || errorString.contains('Failed host lookup')) {
          errorMessage = 'Cannot connect to server. Please ensure backend is running';
        } else if (errorString.contains('timeout')) {
          errorMessage = 'Request timed out. Please check your connection.';
        } else if (errorString.contains('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (errorString.length < 100) {
          errorMessage = errorString;
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.brandBgLight,
      body: Stack(
        children: [
          _buildBackground(),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.screenPadding + AppSpacing.gutterXs,
                    AppSpacing.gutterSm,
                    AppSpacing.screenPadding + AppSpacing.gutterXs,
                    AppSpacing.gutter2xl,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      // Clamp so the zero-sized first layout pass cannot make
                      // minHeight negative and break the frame's layout.
                      minHeight: math.max(
                        0.0,
                        constraints.maxHeight - AppSpacing.gutter2xl,
                      ),
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 460),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _buildTopBar(),
                            const SizedBox(height: AppSpacing.gutterLg),
                            _buildBrandMark(),
                            const SizedBox(height: AppSpacing.gutterXl),
                            _buildWelcomeHeader(),
                            const SizedBox(height: AppSpacing.gutterLg),
                            _buildCard(),
                            const SizedBox(height: AppSpacing.gutterXl),
                            _buildTrustFooter(),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Background decoration
  // ---------------------------------------------------------------------------

  Widget _buildBackground() {
    return Positioned.fill(
      child: IgnorePointer(
        child: Stack(
          children: [
            const ColoredBox(color: AppColors.brandBgLight),
            Positioned(
              top: -130,
              right: -100,
              child: _softBlob(
                size: 320,
                color: AppColors.brandAccentBlue.withValues(alpha: 0.14),
              ),
            ),
            Positioned(
              bottom: -150,
              left: -120,
              child: _softBlob(
                size: 340,
                color: AppColors.medicalTeal.withValues(alpha: 0.12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _softBlob({required double size, required Color color}) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color, color.withValues(alpha: 0.0)],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Top bar and branding
  // ---------------------------------------------------------------------------

  Widget _buildTopBar() {
    if (!Navigator.of(context).canPop()) {
      return const SizedBox(height: AppSpacing.gutterSm);
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.surfaceLowest,
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.slate200.withValues(alpha: 0.8),
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.brandNavy.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          color: AppColors.brandNavy,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
      ),
    );
  }

  Widget _buildBrandMark() {
    return SizedBox(
      width: double.infinity,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.skyBlue, AppColors.brandPrimary],
                ),
                borderRadius: BorderRadius.circular(AppSpacing.radiusXl + 2),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.brandPrimary.withValues(alpha: 0.28),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Icon(
                Icons.location_on,
                color: AppColors.onPrimary,
                size: 28,
              ),
            ),
            const SizedBox(width: AppSpacing.gutterLg),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'FindMyDoctor',
                  style: AppTextStyles.headlineMd.copyWith(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.brandNavy,
                    letterSpacing: -0.2,
                  ),
                ),
                const SizedBox(height: AppSpacing.gutterXs + 2),
                _buildPhilippinesBadge(),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPhilippinesBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.gutterMd,
        vertical: 5,
      ),
      decoration: BoxDecoration(
        color: AppColors.brandTealBadge.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        border: Border.all(
          color: AppColors.brandTealBadge.withValues(alpha: 0.24),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.verified_outlined,
            size: 13,
            color: AppColors.brandTealBadge,
          ),
          const SizedBox(width: AppSpacing.gutterXs + 1),
          Text(
            'PHILIPPINES',
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.brandTealBadge,
              letterSpacing: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWelcomeHeader() {
    return Column(
      children: [
        Text(
          'Verify Your Email',
          textAlign: TextAlign.center,
          style: AppTextStyles.headlineLg.copyWith(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: AppColors.brandNavy,
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterSm),
        Text(
          "We've sent a 6-digit verification code to your email address. "
          'Enter it below to confirm your account.',
          textAlign: TextAlign.center,
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.slate500,
            height: 1.5,
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Card
  // ---------------------------------------------------------------------------

  Widget _buildCard() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.gutterLg + 2),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(AppSpacing.radius2xl),
        border: Border.all(
          color: AppColors.slate200.withValues(alpha: 0.7),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.brandNavy.withValues(alpha: 0.07),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildEmailChip(),
          const SizedBox(height: AppSpacing.gutterXl),
          _buildOTPLabel(),
          const SizedBox(height: AppSpacing.gutterMd),
          _buildOTPInputFields(),
          _buildErrorBanner(),
          const SizedBox(height: AppSpacing.gutterLg),
          _buildVerifyButton(),
          const SizedBox(height: AppSpacing.gutterXl),
          _buildResendSection(),
        ],
      ),
    );
  }

  Widget _buildEmailChip() {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.gutterMd,
        vertical: AppSpacing.gutterSm + 2,
      ),
      decoration: BoxDecoration(
        color: AppColors.brandPrimary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(
          color: AppColors.brandPrimary.withValues(alpha: 0.16),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.email_outlined,
            size: 18,
            color: AppColors.brandPrimary,
          ),
          const SizedBox(width: AppSpacing.gutterSm),
          Expanded(
            child: Text(
              widget.email,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.bodyMdMedium.copyWith(
                color: AppColors.brandNavy,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOTPLabel() {
    return Row(
      children: [
        Expanded(
          child: Text(
            'Enter the 6-digit code',
            style: AppTextStyles.inputLabel,
          ),
        ),
        TextButton.icon(
          onPressed: _isLoading ? null : _handleOTPPaste,
          icon: const Icon(Icons.content_paste, size: 15),
          label: const Text('Paste'),
          style: TextButton.styleFrom(
            foregroundColor: AppColors.brandPrimary,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.gutterSm),
            minimumSize: const Size(0, 32),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            textStyle: AppTextStyles.labelMd.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildOTPInputFields() {
    return GestureDetector(
      onTap: _handleOTPPaste,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final double maxWidth = constraints.maxWidth;
          final double gap = maxWidth < 300
              ? AppSpacing.gutterXs
              : AppSpacing.gutterSm;

          // Size each box so all six always fit, with even spacing, and never
          // grow larger than a comfortable tap target on wide screens. Clamp to
          // zero so a zero-width first layout pass stays valid.
          double boxSize = math.max(0.0, (maxWidth - gap * 5) / 6);
          if (boxSize > 56) boxSize = 56;

          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(6, (index) {
              return Padding(
                padding: EdgeInsets.only(
                  right: index == 5 ? 0 : gap,
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
    final controller = _otpControllers[index];
    final bool isFocused = _focusedIndex == index;
    final bool hasValue = controller.text.isNotEmpty;
    final bool hasError = _errorMessage != null;

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

    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: borderColor, width: borderWidth),
        boxShadow: isFocused && !hasError
            ? [
                BoxShadow(
                  color: AppColors.brandPrimary.withValues(alpha: 0.18),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : const [],
      ),
      child: TextField(
        controller: controller,
        focusNode: _focusNodes[index],
        enabled: !_isLoading,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        textInputAction:
            index == 5 ? TextInputAction.done : TextInputAction.next,
        cursorColor: AppColors.brandPrimary,
        cursorHeight: fontSize * 1.05,
        style: AppTextStyles.headlineMd.copyWith(
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
          color: hasError ? AppColors.onErrorContainer : AppColors.brandNavy,
        ),
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(1),
        ],
        onChanged: (value) => _handleOTPChange(index, value),
        decoration: const InputDecoration(
          counterText: '',
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          disabledBorder: InputBorder.none,
          errorBorder: InputBorder.none,
          focusedErrorBorder: InputBorder.none,
          isDense: true,
          contentPadding: EdgeInsets.zero,
        ),
      ),
    );
  }

  Widget _buildErrorBanner() {
    return AnimatedSize(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      child: _errorMessage == null
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(top: AppSpacing.gutterSm),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.gutterMd,
                  vertical: AppSpacing.gutterMd,
                ),
                decoration: BoxDecoration(
                  color: AppColors.errorContainer.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                  border: Border.all(
                    color: AppColors.error.withValues(alpha: 0.35),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      color: AppColors.error,
                      size: AppSpacing.iconMd,
                    ),
                    const SizedBox(width: AppSpacing.gutterSm),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: AppTextStyles.bodySm.copyWith(
                          color: AppColors.onErrorContainer,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildVerifyButton() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: AppColors.brandPrimary.withValues(alpha: 0.30),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: PrimaryButton(
        text: 'Verify Email',
        onPressed: _handleVerify,
        isLoading: _isLoading,
        icon: const Icon(Icons.arrow_forward, size: 20),
      ),
    );
  }

  Widget _buildResendSection() {
    return Column(
      children: [
        Text(
          "Didn't receive the code?",
          textAlign: TextAlign.center,
          style: AppTextStyles.bodySm.copyWith(color: AppColors.slate500),
        ),
        const SizedBox(height: AppSpacing.gutterMd),
        _canResend ? _buildResendButton() : _buildResendCountdown(),
      ],
    );
  }

  Widget _buildResendButton() {
    return OutlinedButton.icon(
      onPressed: (_canResend && !_isLoading) ? _handleResendOTP : null,
      icon: const Icon(Icons.refresh, size: 18),
      label: const Text('Resend Code'),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.brandPrimary,
        disabledForegroundColor: AppColors.slate400,
        backgroundColor: AppColors.brandPrimary.withValues(alpha: 0.04),
        side: BorderSide(
          color: AppColors.brandPrimary.withValues(alpha: 0.35),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.gutterXl,
          vertical: AppSpacing.gutterMd,
        ),
        minimumSize: const Size(0, AppSpacing.touchTarget),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: const StadiumBorder(),
        textStyle: AppTextStyles.labelMd.copyWith(fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _buildResendCountdown() {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.gutterLg,
        vertical: AppSpacing.gutterMd,
      ),
      decoration: BoxDecoration(
        color: AppColors.slate100,
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        border: Border.all(color: AppColors.slate200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.schedule,
            size: 16,
            color: AppColors.slate400,
          ),
          const SizedBox(width: AppSpacing.gutterSm),
          Flexible(
            child: Text(
              'Resend Code in ${_resendCountdown}s',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.bodySm.copyWith(
                color: AppColors.slate500,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------

  Widget _buildTrustFooter() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(
          Icons.lock_outline,
          size: 14,
          color: AppColors.slate400,
        ),
        const SizedBox(width: AppSpacing.gutterSm),
        Flexible(
          child: Text(
            'Your information is kept secure and private.',
            textAlign: TextAlign.center,
            style: AppTextStyles.bodySm.copyWith(color: AppColors.slate400),
          ),
        ),
      ],
    );
  }
}
