import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';
import 'otp_verification_page.dart';

class SignUpPage extends StatefulWidget {
  /// Optional injected API service (test seam); defaults to the singleton.
  final ApiService? apiService;

  const SignUpPage({super.key, this.apiService});

  @override
  State<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends State<SignUpPage> {
  final _formKey = GlobalKey<FormState>();

  // Personal information
  final _firstNameController = TextEditingController();
  final _middleNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _dateOfBirthController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();

  // Account credentials
  final _emailController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isLoading = false;
  bool _agreeToTerms = false;
  String? _errorMessage;

  // Sex selection (backend values)
  String? _selectedSex;
  final FocusNode _sexFocusNode = FocusNode();
  bool _sexHasFocus = false;

  static const List<String> _sexOptions = [
    'MALE',
    'FEMALE',
    'OTHER',
    'NOT_SPECIFIED',
  ];

  static const Map<String, String> _sexLabels = {
    'MALE': 'Male',
    'FEMALE': 'Female',
    'OTHER': 'Other',
    'NOT_SPECIFIED': 'Prefer not to say',
  };

  // Password requirement indicators (advisory strength hints)
  bool _hasMinLength = false;
  bool _hasNumber = false;
  bool _hasUppercase = false;

  late final ApiService _apiService;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _sexFocusNode.addListener(_handleSexFocusChange);
  }

  void _handleSexFocusChange() {
    if (!mounted) return;
    setState(() {
      _sexHasFocus = _sexFocusNode.hasFocus;
    });
  }

  @override
  void dispose() {
    _sexFocusNode.removeListener(_handleSexFocusChange);
    _sexFocusNode.dispose();
    _firstNameController.dispose();
    _middleNameController.dispose();
    _lastNameController.dispose();
    _dateOfBirthController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _emailController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _validatePassword(String value) {
    setState(() {
      _hasMinLength = value.length >= 8;
      _hasNumber = value.contains(RegExp(r'[0-9]'));
      _hasUppercase = value.contains(RegExp(r'[A-Z]'));
    });
  }

  Future<void> _selectDateOfBirth() async {
    FocusScope.of(context).unfocus();

    final DateTime initialDate =
        DateTime.now().subtract(const Duration(days: 365 * 18));
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      helpText: 'Select date of birth',
    );

    if (picked != null) {
      setState(() {
        _dateOfBirthController.text = DateFormat('yyyy-MM-dd').format(picked);
      });
    }
  }

  Future<void> _handleSignUp() async {
    FocusScope.of(context).unfocus();

    if (_errorMessage != null) {
      setState(() {
        _errorMessage = null;
      });
    }

    if (!(_formKey.currentState?.validate() ?? false)) {
      return;
    }

    if (!_agreeToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please agree to the Terms of Service and Privacy Policy'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (_passwordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Passwords do not match'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final firstName = _firstNameController.text.trim();
      final middleName = _middleNameController.text.trim();
      final lastName = _lastNameController.text.trim();
      final email = _emailController.text.trim();
      final username = _usernameController.text.trim();
      final password = _passwordController.text;
      final confirmPassword = _confirmPasswordController.text;
      final dateOfBirth = _dateOfBirthController.text.trim();
      final phone = _phoneController.text.trim();
      final address = _addressController.text.trim();

      // Call the backend API to stage the sign-up and send the OTP
      final response = await _apiService.sendPatientOtp(
        email: email,
        firstName: firstName,
        middleName: middleName.isEmpty ? null : middleName,
        lastName: lastName,
        dateOfBirth: dateOfBirth,
        sex: _selectedSex ?? 'NOT_SPECIFIED',
        phone: phone,
        address: address,
        username: username,
        password: password,
        confirmPassword: confirmPassword,
      );

      if (mounted) {
        setState(() {
          _isLoading = false;
        });

        if (response['success'] == true) {
          // Navigate to OTP verification page
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (context) => OTPVerificationPage(
                email: email,
                firstName: firstName,
                lastName: lastName,
                username: username,
                password: password,
              ),
            ),
          );
        } else {
          final message = response['error']?['message'] ?? 'Failed to send OTP';
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
        } else if (e is ApiException && e.statusCode == 409) {
          // The /send endpoint returns 409 for an email or username that is
          // already registered. Show the backend's message verbatim so a taken
          // username is reported on this form (before any OTP is sent) instead
          // of being mislabelled as an email conflict.
          errorMessage = e.message.trim().isNotEmpty
              ? e.message
              : 'Email or username is already registered.';
        } else if (errorString.contains('400')) {
          errorMessage = 'Invalid input. Please check your information.';
        } else if (errorString.contains('500')) {
          errorMessage = 'Server error. Please try again later.';
        } else if (errorString.length < 100) {
          errorMessage = errorString; // Show short error messages
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
                              const SizedBox(height: AppSpacing.gutterLg),
                              _buildLoginLink(),
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
          'Create an Account',
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
          'Join FindMyDoctor to book appointments and track your queue.',
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
  // Form card
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
        children: [
          // Personal information section
          _buildSectionHeader(
            icon: Icons.person_outline,
            title: 'Personal Information',
            subtitle: 'Tell us about the patient',
          ),
          const SizedBox(height: AppSpacing.gutterLg),

          _buildFirstNameField(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildMiddleNameField(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildLastNameField(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildDateOfBirthField(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildSexField(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildMobileField(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildAddressField(),

          const SizedBox(height: AppSpacing.gutter2xl),

          // Account credentials section
          _buildSectionHeader(
            icon: Icons.lock_outline,
            title: 'Account Credentials',
            subtitle: 'Set up your login details',
          ),
          const SizedBox(height: AppSpacing.gutterLg),

          _buildEmailField(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildUsernameField(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildPasswordField(),
          const SizedBox(height: AppSpacing.gutterSm),
          _buildPasswordRequirements(),
          const SizedBox(height: AppSpacing.gutterMd + 2),
          _buildConfirmPasswordField(),

          const SizedBox(height: AppSpacing.gutterMd),
          _buildTermsCheckbox(),

          const SizedBox(height: AppSpacing.gutterMd),
          _buildErrorBanner(),
          _buildCreateAccountButton(),
        ],
      ),
    );
  }

  Widget _buildSectionHeader({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.brandPrimary.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd + 2),
          ),
          child: Icon(icon, size: 18, color: AppColors.brandPrimary),
        ),
        const SizedBox(width: AppSpacing.gutterMd),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTextStyles.labelMd.copyWith(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.brandNavy,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: AppTextStyles.bodySm.copyWith(
                  color: AppColors.slate500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildFirstNameField() {
    return CustomTextField(
      label: 'First Name',
      hint: 'Enter your first name',
      controller: _firstNameController,
      keyboardType: TextInputType.name,
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.person_outline,
      enabled: !_isLoading,
      maxLength: 100,
      borderRadius: AppSpacing.radiusXl,
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'First name is required';
        }
        if (value.trim().length > 100) {
          return 'First name must be 1-100 characters';
        }
        return null;
      },
    );
  }

  Widget _buildMiddleNameField() {
    return CustomTextField(
      label: 'Middle Name (Optional)',
      hint: 'Enter your middle name',
      controller: _middleNameController,
      keyboardType: TextInputType.name,
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.person_outline,
      enabled: !_isLoading,
      maxLength: 100,
      borderRadius: AppSpacing.radiusXl,
      validator: (value) {
        if (value != null &&
            value.trim().isNotEmpty &&
            value.trim().length > 100) {
          return 'Middle name must be maximum 100 characters';
        }
        return null;
      },
    );
  }

  Widget _buildLastNameField() {
    return CustomTextField(
      label: 'Last Name',
      hint: 'Enter your last name',
      controller: _lastNameController,
      keyboardType: TextInputType.name,
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.person_outline,
      enabled: !_isLoading,
      maxLength: 100,
      borderRadius: AppSpacing.radiusXl,
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Last name is required';
        }
        if (value.trim().length > 100) {
          return 'Last name must be 1-100 characters';
        }
        return null;
      },
    );
  }

  Widget _buildDateOfBirthField() {
    return CustomTextField(
      label: 'Date of Birth',
      hint: 'YYYY-MM-DD',
      controller: _dateOfBirthController,
      keyboardType: TextInputType.datetime,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.calendar_today_outlined,
      readOnly: true,
      onTap: _isLoading ? null : _selectDateOfBirth,
      borderRadius: AppSpacing.radiusXl,
      suffixIcon: IconButton(
        tooltip: 'Select date of birth',
        icon: const Icon(Icons.calendar_month),
        color: AppColors.brandPrimary,
        onPressed: _isLoading ? null : _selectDateOfBirth,
      ),
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Date of birth is required';
        }
        try {
          final dob = DateTime.parse(value.trim());
          if (dob.isAfter(DateTime.now())) {
            return 'Date of birth cannot be in the future';
          }
        } catch (e) {
          return 'Invalid date format (use YYYY-MM-DD)';
        }
        return null;
      },
    );
  }

  Widget _buildSexField() {
    const double radius = AppSpacing.radiusXl;
    final bool isEnabled = !_isLoading;
    final Color accentColor = !isEnabled
        ? AppColors.slate300
        : (_sexHasFocus ? AppColors.brandPrimary : AppColors.slate400);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Sex',
          style: AppTextStyles.inputLabel,
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            // Mirrors the elevated focus accent used by CustomTextField.
            boxShadow: _sexHasFocus && isEnabled
                ? [
                    BoxShadow(
                      color: AppColors.primary.withValues(alpha: 0.12),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : const [],
          ),
          child: Theme(
            // Cohesive pressed/highlight feedback for the field and its menu.
            data: Theme.of(context).copyWith(
              splashColor: AppColors.brandPrimary.withValues(alpha: 0.10),
              highlightColor: AppColors.brandPrimary.withValues(alpha: 0.06),
            ),
            child: DropdownButtonFormField<String>(
              initialValue: _selectedSex,
              focusNode: _sexFocusNode,
              isExpanded: true,
              menuMaxHeight: 320,
              itemHeight: 56,
              borderRadius: BorderRadius.circular(radius),
              dropdownColor: AppColors.surfaceLowest,
              elevation: 8,
              alignment: AlignmentDirectional.centerStart,
              icon: AnimatedRotation(
                turns: _sexHasFocus ? 0.5 : 0.0,
                duration: const Duration(milliseconds: 180),
                child: Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 22,
                  color: accentColor,
                ),
              ),
              iconSize: 22,
              hint: Text(
                'Select sex',
                style: AppTextStyles.inputPlaceholder,
              ),
              style: AppTextStyles.inputText,
              decoration: InputDecoration(
                filled: true,
                fillColor: AppColors.surfaceLowest,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.gutterXl + AppSpacing.gutterSm,
                  vertical: AppSpacing.gutterMd,
                ),
                prefixIcon: Icon(
                  Icons.wc,
                  color: accentColor,
                  size: AppSpacing.iconMd,
                ),
                border: _sexBorder(AppColors.slate300),
                enabledBorder: _sexBorder(AppColors.slate300),
                disabledBorder: _sexBorder(AppColors.slate200),
                focusedBorder: _sexBorder(AppColors.primary, width: 2),
                errorBorder: _sexBorder(AppColors.error),
                focusedErrorBorder: _sexBorder(AppColors.error, width: 2),
              ),
              // The closed field shows only the selected label, styled like the
              // other text inputs. The menu items (below) add the selection cue.
              selectedItemBuilder: (BuildContext context) => _sexOptions
                  .map(
                    (value) => Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        _sexLabels[value] ?? value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTextStyles.inputText,
                      ),
                    ),
                  )
                  .toList(),
              items: _sexOptions.map((String value) {
                final bool isSelected = value == _selectedSex;
                return DropdownMenuItem<String>(
                  value: value,
                  child: _buildSexOption(
                    _sexLabels[value] ?? value,
                    isSelected,
                  ),
                );
              }).toList(),
              onChanged: isEnabled
                  ? (String? newValue) {
                      setState(() {
                        _selectedSex = newValue;
                      });
                    }
                  : null,
              validator: (value) {
                if (value == null || value.isEmpty) {
                  return 'Sex is required';
                }
                return null;
              },
            ),
          ),
        ),
      ],
    );
  }

  /// Rounded, selectable row used inside the expanded sex options list.
  Widget _buildSexOption(String label, bool isSelected) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.gutterMd,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: isSelected
            ? AppColors.brandPrimary.withValues(alpha: 0.10)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd + 2),
        border: isSelected
            ? Border.all(
                color: AppColors.brandPrimary.withValues(alpha: 0.22),
              )
            : null,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTextStyles.inputText.copyWith(
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                color: isSelected
                    ? AppColors.brandPrimary
                    : AppColors.onSurface,
              ),
            ),
          ),
          if (isSelected)
            const Padding(
              padding: EdgeInsets.only(left: AppSpacing.gutterSm),
              child: Icon(
                Icons.check_rounded,
                size: 20,
                color: AppColors.brandPrimary,
              ),
            ),
        ],
      ),
    );
  }

  OutlineInputBorder _sexBorder(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppSpacing.radiusXl),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  Widget _buildMobileField() {
    return CustomTextField(
      label: 'Mobile Number',
      hint: '09XX XXX XXXX',
      controller: _phoneController,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.phone_outlined,
      enabled: !_isLoading,
      maxLength: 20,
      borderRadius: AppSpacing.radiusXl,
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[\d\s\-\+\(\)]')),
      ],
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Mobile number is required';
        }
        if (value.trim().length > 20) {
          return 'Mobile number must be 1-20 characters';
        }
        if (!RegExp(r'^[\d\s\-\+\(\)]+$').hasMatch(value.trim())) {
          return 'Enter a valid mobile number';
        }
        return null;
      },
    );
  }

  Widget _buildAddressField() {
    return CustomTextField(
      label: 'Address',
      hint: 'Enter your full address',
      controller: _addressController,
      keyboardType: TextInputType.streetAddress,
      textCapitalization: TextCapitalization.sentences,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.location_on_outlined,
      enabled: !_isLoading,
      maxLines: 2,
      borderRadius: AppSpacing.radiusXl,
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Address is required';
        }
        return null;
      },
    );
  }

  Widget _buildEmailField() {
    return CustomTextField(
      label: 'Email Address',
      hint: 'you@example.com',
      controller: _emailController,
      keyboardType: TextInputType.emailAddress,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.email_outlined,
      enabled: !_isLoading,
      borderRadius: AppSpacing.radiusXl,
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Please enter your email';
        }
        if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$')
            .hasMatch(value.trim())) {
          return 'Please enter a valid email';
        }
        return null;
      },
    );
  }

  Widget _buildUsernameField() {
    return CustomTextField(
      label: 'Username',
      hint: 'e.g. juanreyes',
      controller: _usernameController,
      keyboardType: TextInputType.text,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.badge_outlined,
      enabled: !_isLoading,
      borderRadius: AppSpacing.radiusXl,
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Please enter a username';
        }
        if (value.trim().length < 3) {
          return 'Username must be at least 3 characters';
        }
        return null;
      },
    );
  }

  Widget _buildPasswordField() {
    return CustomTextField(
      label: 'Password',
      hint: 'Create a password (min. 8 characters)',
      controller: _passwordController,
      obscureText: true,
      enablePasswordToggle: true,
      textInputAction: TextInputAction.next,
      prefixIcon: Icons.lock_outline,
      enabled: !_isLoading,
      borderRadius: AppSpacing.radiusXl,
      onChanged: _validatePassword,
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please enter your password';
        }
        if (value.length < 8) {
          return 'Password must be at least 8 characters';
        }
        return null;
      },
    );
  }

  Widget _buildConfirmPasswordField() {
    return CustomTextField(
      label: 'Confirm Password',
      hint: 'Re-enter your password',
      controller: _confirmPasswordController,
      obscureText: true,
      enablePasswordToggle: true,
      textInputAction: TextInputAction.done,
      prefixIcon: Icons.lock_outline,
      enabled: !_isLoading,
      borderRadius: AppSpacing.radiusXl,
      onSubmitted: (_) => _handleSignUp(),
      validator: (value) {
        if (value == null || value.isEmpty) {
          return 'Please confirm your password';
        }
        if (value != _passwordController.text) {
          return 'Passwords do not match';
        }
        return null;
      },
    );
  }

  Widget _buildPasswordRequirements() {
    return Wrap(
      spacing: AppSpacing.gutterSm,
      runSpacing: AppSpacing.gutterSm,
      children: [
        _buildRequirementPill('8+ characters', _hasMinLength),
        _buildRequirementPill('1 number', _hasNumber),
        _buildRequirementPill('1 uppercase', _hasUppercase),
      ],
    );
  }

  Widget _buildRequirementPill(String text, bool isMet) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.gutterSm,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: isMet
            ? AppColors.brandTealBadge.withValues(alpha: 0.1)
            : AppColors.slate100,
        border: Border.all(
          color: isMet
              ? AppColors.brandTealBadge.withValues(alpha: 0.6)
              : AppColors.slate300,
        ),
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isMet ? Icons.check : Icons.circle,
            size: 12,
            color: isMet ? AppColors.brandTealBadge : AppColors.slate400,
          ),
          const SizedBox(width: 4),
          Text(
            text,
            style: AppTextStyles.labelSm.copyWith(
              color: isMet ? AppColors.brandTealBadge : AppColors.slate600,
              fontWeight: FontWeight.w500,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTermsCheckbox() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: AppSpacing.touchTarget,
          height: AppSpacing.touchTarget,
          child: Checkbox(
            value: _agreeToTerms,
            onChanged: _isLoading
                ? null
                : (value) {
                    setState(() {
                      _agreeToTerms = value ?? false;
                    });
                  },
            activeColor: AppColors.brandPrimary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.gutterSm),
        Expanded(
          child: GestureDetector(
            onTap: _isLoading
                ? null
                : () {
                    setState(() {
                      _agreeToTerms = !_agreeToTerms;
                    });
                  },
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.gutterMd),
              child: Text(
                'I agree to FindMyDoctor\'s Terms of Service and Privacy Policy, including Philippine Data Privacy Act compliance.',
                style: AppTextStyles.bodySm.copyWith(
                  color: AppColors.slate600,
                  height: 1.4,
                ),
              ),
            ),
          ),
        ),
      ],
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

  Widget _buildCreateAccountButton() {
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
        text: 'Create Account',
        onPressed: _handleSignUp,
        isLoading: _isLoading,
        icon: const Icon(Icons.arrow_forward, size: 20),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------

  Widget _buildLoginLink() {
    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Flexible(
            child: Text(
              'Already have an account?',
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.slate500),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.gutterSm,
              ),
              minimumSize: const Size(0, AppSpacing.touchTarget),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              foregroundColor: AppColors.brandPrimary,
            ),
            child: Text(
              'Log In',
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.brandPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

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
