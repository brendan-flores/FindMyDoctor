import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  final String? phone;
  final String? password;

  const OTPVerificationPage({
    super.key,
    required this.email,
    this.firstName,
    this.lastName,
    this.phone,
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

  final ApiService _apiService = ApiService();

  @override
  void initState() {
    super.initState();
    _startResendTimer();
    // Auto-focus the first OTP field
    Future.delayed(const Duration(milliseconds: 100), () {
      _focusNodes[0].requestFocus();
    });
  }

  @override
  void dispose() {
    for (var controller in _otpControllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid 6-digit OTP code'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
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
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['error']?['message'] ?? 'Verification failed'),
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

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: AppColors.error,
          ),
        );
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
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: EdgeInsets.all(AppSpacing.screenPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: AppSpacing.gutterMd),
                // Back button
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.arrow_back_ios_new),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
                const SizedBox(height: AppSpacing.gutterLg),

                // Brand Header
                _buildBrandHeader(),
                const SizedBox(height: AppSpacing.gutter3xl),

                // OTP Verification Header
                _buildOTPHeader(),
                const SizedBox(height: AppSpacing.gutter2xl),

                // OTP Input Fields
                _buildOTPInputFields(),
                const SizedBox(height: AppSpacing.gutter2xl),

                // Resend OTP Timer
                _buildResendOTP(),
                const SizedBox(height: AppSpacing.gutter2xl),

                // Verify Button
                PrimaryButton(
                  text: 'Verify Email',
                  onPressed: _isOTPValid ? _handleVerify : null,
                  isLoading: _isLoading,
                  icon: const Icon(Icons.arrow_forward, size: 20),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBrandHeader() {
    return Row(
      children: [
        // Logo placeholder - replace with actual logo
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.brandAccentBlue,
                AppColors.brandPrimary,
              ],
            ),
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.15),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(
            Icons.location_on,
            color: AppColors.onPrimary,
            size: 24,
          ),
        ),
        const SizedBox(width: AppSpacing.gutterMd),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'FindMyDoctor',
              style: AppTextStyles.headlineMd.copyWith(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.brandNavy,
              ),
            ),
            Text(
              'PHILIPPINES',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.brandTealBadge,
                letterSpacing: 0.16,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildOTPHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Verify Your Email',
          style: AppTextStyles.headlineLg.copyWith(
            fontSize: 26,
            color: AppColors.brandNavy,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterSm),
        Text(
          'We sent a 6-digit code to ${widget.email}',
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.slate500,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        Text(
          'Enter the code below to verify your account',
          style: AppTextStyles.bodySm.copyWith(
            color: AppColors.slate400,
          ),
        ),
      ],
    );
  }

  Widget _buildOTPInputFields() {
    return GestureDetector(
      onTap: _handleOTPPaste,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: List.generate(6, (index) {
          return SizedBox(
            width: 48,
            height: 56,
            child: TextField(
              controller: _otpControllers[index],
              focusNode: _focusNodes[index],
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              style: AppTextStyles.headlineMd.copyWith(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: AppColors.brandNavy,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(1),
              ],
              onChanged: (value) => _handleOTPChange(index, value),
              decoration: InputDecoration(
                filled: true,
                fillColor: AppColors.slate100,
                contentPadding: EdgeInsets.zero,
                border: OutlineInputBorder(
                  borderSide: BorderSide(color: AppColors.slate300),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                focusedBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: AppColors.brandPrimary, width: 2),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                enabledBorder: OutlineInputBorder(
                  borderSide: BorderSide(color: AppColors.slate300),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildResendOTP() {
    return Center(
      child: _canResend
          ? TextButton(
              onPressed: _handleResendOTP,
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                'Resend Code',
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.brandPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : Text(
              'Resend Code in ${_resendCountdown}s',
              style: AppTextStyles.bodySm.copyWith(
                color: AppColors.slate400,
              ),
            ),
    );
  }
}