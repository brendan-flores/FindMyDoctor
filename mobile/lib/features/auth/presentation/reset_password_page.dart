import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';

class ResetPasswordPage extends StatefulWidget {
  final String email;

  const ResetPasswordPage({super.key, required this.email});

  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isVerifying = false;
  bool _isLoading = false;
  bool _isSuccess = false;
  String? _errorMessage;

  // Two-step verification state
  bool _isCodeVerified = false;
  String? _resetToken;

  // Password requirement indicators
  bool _hasMinLength = false;
  bool _hasNumber = false;
  bool _hasUppercase = false;

  // Resend cooldown
  int _resendCooldownSeconds = 60;
  Timer? _resendTimer;

  final ApiService _apiService = ApiService();

  @override
  void initState() {
    super.initState();
    _startResendCooldown();
  }

  @override
  void dispose() {
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _resendTimer?.cancel();
    super.dispose();
  }

  void _startResendCooldown() {
    setState(() {
      _resendCooldownSeconds = 60;
    });

    _resendTimer?.cancel();
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) {
        setState(() {
          _resendCooldownSeconds--;
        });

        if (_resendCooldownSeconds <= 0) {
          timer.cancel();
        }
      }
    });
  }

  void _validatePassword(String value) {
    setState(() {
      _hasMinLength = value.length >= 8;
      _hasNumber = value.contains(RegExp(r'[0-9]'));
      _hasUppercase = value.contains(RegExp(r'[A-Z]'));
    });
  }

  Future<void> _handleResendCode() async {
    if (_resendCooldownSeconds > 0) {
      return;
    }

    try {
      final response = await _apiService.requestPasswordReset(widget.email);

      if (mounted) {
        if (response['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Reset code sent successfully'),
              backgroundColor: AppColors.brandPrimary,
              behavior: SnackBarBehavior.floating,
            ),
          );
          _startResendCooldown();
        } else {
          final message = response['error']?['message'] ?? 'Failed to resend code';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(message),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to resend code. Please try again.'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _handleVerifyCode() async {
    FocusScope.of(context).unfocus();

    if (_errorMessage != null) {
      setState(() {
        _errorMessage = null;
      });
    }

    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      setState(() {
        _errorMessage = 'Please enter a valid 6-digit code';
      });
      return;
    }

    setState(() {
      _isVerifying = true;
    });

    try {
      final response = await _apiService.verifyPasswordResetOtp(
        email: widget.email,
        otp: otp,
      );

      if (mounted) {
        setState(() {
          _isVerifying = false;
        });

        if (response['success'] == true && response['data']?['resetToken'] != null) {
          setState(() {
            _isCodeVerified = true;
            _resetToken = response['data']['resetToken'];
            _errorMessage = null;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Code verified successfully. Enter your new password.'),
              backgroundColor: AppColors.brandPrimary,
              behavior: SnackBarBehavior.floating,
            ),
          );
        } else {
          final message = response['error']?['message'] ?? 'Invalid or expired verification code';
          setState(() {
            _errorMessage = message;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(message),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isVerifying = false;
        });
        String errorMessage = 'An error occurred during verification. Please try again.';
        final errorString = e.toString();

        if (errorString.contains('Connection refused') ||
            errorString.contains('Failed host lookup')) {
          errorMessage =
              'Cannot connect to server. Please ensure backend is running at http://10.0.2.2:3000';
        } else if (errorString.contains('timeout')) {
          errorMessage = 'Request timed out. Please check your connection.';
        } else if (errorString.length < 100) {
          errorMessage = errorString;
        }

        setState(() {
          _errorMessage = errorMessage;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: AppColors.error,
            duration: const Duration(seconds: 5),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Future<void> _handleResetPassword() async {
    FocusScope.of(context).unfocus();

    if (_errorMessage != null) {
      setState(() {
        _errorMessage = null;
      });
    }

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    if (_newPasswordController.text != _confirmPasswordController.text) {
      setState(() {
        _errorMessage = 'Passwords do not match';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Passwords do not match'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (_resetToken == null) {
      setState(() {
        _errorMessage = 'Please verify your verification code first.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final newPassword = _newPasswordController.text;

      final response = await _apiService.resetPassword(
        email: widget.email,
        resetToken: _resetToken!,
        newPassword: newPassword,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        if (response['success'] == true) {
          setState(() {
            _isSuccess = true;
          });
          // Show success message and navigate back to login
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Password reset successfully. Please log in with your new password.'),
              backgroundColor: AppColors.brandPrimary,
              duration: Duration(seconds: 3),
              behavior: SnackBarBehavior.floating,
            ),
          );

          await Future.delayed(const Duration(milliseconds: 500));

          if (mounted) {
            Navigator.of(context).popUntil((route) => route.isFirst);
          }
        } else {
          final message = response['error']?['message'] ?? 'Failed to reset password';
          setState(() {
            _errorMessage = message;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(message),
              backgroundColor: AppColors.error,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        String errorMessage = 'An error occurred. Please try again.';
        String errorString = e.toString();

        if (errorString.contains('Connection refused') ||
            errorString.contains('Failed host lookup')) {
          errorMessage =
              'Cannot connect to server. Please ensure backend is running at http://10.0.2.2:3000';
        } else if (errorString.contains('timeout')) {
          errorMessage = 'Request timed out. Please check your connection.';
        } else if (errorString.length < 100) {
          errorMessage = errorString;
        }

        setState(() {
          _errorMessage = errorMessage;
        });

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: AppColors.error,
            duration: const Duration(seconds: 5),
            behavior: SnackBarBehavior.floating,
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
                      minHeight: math.max(
                        0.0,
                        constraints.maxHeight - AppSpacing.gutter2xl,
                      ),
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 460),
                        child: Form(
                          key: _formKey,
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
                              _buildFormCard(),
                              const SizedBox(height: AppSpacing.gutterXl),
                              _buildTrustFooter(),
                            ],
                          ),
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
  // Top bar
  // ---------------------------------------------------------------------------

  Widget _buildTopBar() {
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

  // ---------------------------------------------------------------------------
  // Branding
  // ---------------------------------------------------------------------------

  Widget _buildBrandMark() {
    return SizedBox(
      width: double.infinity,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Image.asset(
          'assets/images/findmydoctor_logo.png',
          height: 80,
          fit: BoxFit.contain,
        ),
      ),
    );
  }

  Widget _buildWelcomeHeader() {
    return Column(
      children: [
        Text(
          'Reset Password',
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
          _isCodeVerified
              ? 'Enter your new password below.'
              : 'Enter the code sent to ${widget.email}',
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
  // Form
  // ---------------------------------------------------------------------------

  Widget _buildFormCard() {
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
        children: _isCodeVerified
            ? [
                _buildNewPasswordField(),
                const SizedBox(height: AppSpacing.gutterSm),
                _buildPasswordRequirements(),
                const SizedBox(height: AppSpacing.gutterMd + 2),
                _buildConfirmPasswordField(),
                const SizedBox(height: AppSpacing.gutterMd),
                _buildErrorBanner(),
                _buildResetButton(),
              ]
            : [
                _buildOtpField(),
                const SizedBox(height: AppSpacing.gutterMd),
                _buildResendButton(),
                const SizedBox(height: AppSpacing.gutterMd),
                _buildErrorBanner(),
                _buildVerifyButton(),
              ],
      ),
    );
  }

  Widget _buildOtpField() {
    return CustomTextField(
      label: 'Verification Code',
      hint: 'Enter 6-digit code',
      controller: _otpController,
      keyboardType: TextInputType.number,
      textInputAction: TextInputAction.done,
      prefixIcon: Icons.lock_outlined,
      enabled: !_isVerifying,
      borderRadius: AppSpacing.radiusXl,
      maxLength: 6,
      onSubmitted: (_) => _handleVerifyCode(),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter the verification code';
        }
        if (value.length != 6) {
          return 'Please enter a valid 6-digit code';
        }
        return null;
      },
    );
  }

  Widget _buildNewPasswordField() {
    return CustomTextField(
      label: 'New Password',
      hint: 'Enter your new password',
      controller: _newPasswordController,
      obscureText: true,
      enablePasswordToggle: true,
      prefixIcon: Icons.lock_outlined,
      enabled: !_isLoading,
      borderRadius: AppSpacing.radiusXl,
      onChanged: _validatePassword,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter your new password';
        }
        if (value.length < 8) {
          return 'Password must be at least 8 characters';
        }
        return null;
      },
    );
  }

  Widget _buildPasswordRequirements() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildRequirementIndicator('At least 8 characters', _hasMinLength),
        _buildRequirementIndicator('At least 1 number', _hasNumber),
        _buildRequirementIndicator('At least 1 uppercase letter', _hasUppercase),
      ],
    );
  }

  Widget _buildRequirementIndicator(String text, bool met) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(
            met ? Icons.check_circle : Icons.circle_outlined,
            size: 14,
            color: met ? AppColors.brandTealBadge : AppColors.slate400,
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: AppTextStyles.bodySm.copyWith(
              color: met ? AppColors.brandTealBadge : AppColors.slate400,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConfirmPasswordField() {
    return CustomTextField(
      label: 'Confirm Password',
      hint: 'Confirm your new password',
      controller: _confirmPasswordController,
      obscureText: true,
      enablePasswordToggle: true,
      prefixIcon: Icons.lock_outlined,
      enabled: !_isLoading,
      borderRadius: AppSpacing.radiusXl,
      onSubmitted: (_) => _handleResetPassword(),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please confirm your new password';
        }
        if (value != _newPasswordController.text) {
          return 'Passwords do not match';
        }
        return null;
      },
    );
  }

  Widget _buildResendButton() {
    final canResend = _resendCooldownSeconds <= 0;

    return TextButton(
      onPressed: canResend ? _handleResendCode : null,
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.gutterSm,
          vertical: AppSpacing.gutterXs,
        ),
        minimumSize: const Size(0, 44),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        foregroundColor: AppColors.brandPrimary,
      ),
      child: Text(
        canResend
            ? 'Resend Code'
            : 'Resend Code (${_resendCooldownSeconds}s)',
        style: AppTextStyles.labelMd.copyWith(
          color: canResend ? AppColors.brandPrimary : AppColors.slate400,
          fontWeight: FontWeight.w600,
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
              padding: const EdgeInsets.only(bottom: AppSpacing.gutterMd),
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
    const Color buttonColor = AppColors.brandPrimary;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: buttonColor.withValues(alpha: 0.30),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: PrimaryButton(
        text: _isVerifying ? 'Verifying...' : 'Verify Code',
        onPressed: _handleVerifyCode,
        isLoading: _isVerifying,
        backgroundColor: buttonColor,
        icon: const Icon(
          Icons.check_circle_outline,
          size: 20,
        ),
      ),
    );
  }

  Widget _buildResetButton() {
    final Color buttonColor = _isSuccess
        ? AppColors.brandTealBadge
        : AppColors.brandPrimary;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: buttonColor.withValues(alpha: 0.30),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: PrimaryButton(
        text: _isSuccess ? 'Password Reset' : 'Reset Password',
        onPressed: _handleResetPassword,
        isLoading: _isLoading,
        backgroundColor: buttonColor,
        icon: Icon(
          _isSuccess ? Icons.check_circle_outline : Icons.lock_reset,
          size: 20,
        ),
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
          size: 16,
          color: AppColors.slate400,
        ),
        const SizedBox(width: AppSpacing.gutterXs),
        Text(
          'Secure password reset',
          style: AppTextStyles.bodySm.copyWith(
            color: AppColors.slate400,
          ),
        ),
      ],
    );
  }
}
