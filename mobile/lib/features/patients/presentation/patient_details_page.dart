import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:phone_numbers_parser/phone_numbers_parser.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../core/widgets/international_phone_input.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/phone_input.dart';

/// Warning shown when a stored phone number cannot be used as a mobile number
/// and is preserved verbatim so the user can review and correct it.
const String _storedPhoneWarning =
    'This saved number is not a recognized mobile number. Please re-enter it.';

class PatientDetailsPage extends StatefulWidget {
  final String doctorId;
  final String? doctorName;
  final String? specialty;
  final String? clinic;
  final String? consultationFee;
  final DateTime? selectedDate;
  final String? paymentMethod;
  final String? professionalPhotoUrl;

  /// Optional injected API service (test seam); defaults to the singleton.
  final ApiService? apiService;

  const PatientDetailsPage({
    super.key,
    required this.doctorId,
    this.doctorName,
    this.specialty,
    this.clinic,
    this.consultationFee,
    this.selectedDate,
    this.paymentMethod,
    this.professionalPhotoUrl,
    this.apiService,
  });

  @override
  State<PatientDetailsPage> createState() => _PatientDetailsPageState();
}

class _PatientDetailsPageState extends State<PatientDetailsPage> {
  late final ApiService _apiService;
  final _formKey = GlobalKey<FormState>();

  final _firstNameController = TextEditingController();
  final _middleNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _dateOfBirthController = TextEditingController();
  final _addressController = TextEditingController();

  String? _email;
  String _selectedSex = 'NOT_SPECIFIED';
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  String? _phoneInputError;
  String? _phoneRestoreWarning;

  // Mobile phone (international input)
  final _phoneInputKey = GlobalKey<InternationalPhoneInputState>();
  IsoCode _selectedCountry = IsoCode.PH;
  String _nationalNumber = '';

  final List<String> _sexOptions = ['MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'];

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _loadPatientProfile();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _middleNameController.dispose();
    _lastNameController.dispose();
    _dateOfBirthController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _loadPatientProfile() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getCurrentPatient();

      if (response['success'] == true) {
        final patientData = response['data'];
        setState(() {
          _email = patientData['email'];
          _firstNameController.text = patientData['first_name'] ?? '';
          _middleNameController.text = patientData['middle_name'] ?? '';
          _lastNameController.text = patientData['last_name'] ?? '';

          if (patientData['date_of_birth'] != null) {
            final dob = DateTime.parse(patientData['date_of_birth'].toString());
            _dateOfBirthController.text = DateFormat('yyyy-MM-dd').format(dob);
          }

          _selectedSex = patientData['sex'] ?? 'NOT_SPECIFIED';
          _restoreStoredPhone(patientData['phone']?.toString());
          _addressController.text = patientData['address'] ?? '';
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage =
              response['error']?['message'] ?? 'Failed to load patient profile';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load patient profile: $e';
        _isLoading = false;
      });
    }
  }

  /// Restores a stored phone number into the country + national number fields.
  /// Philippine domestic and E.164 numbers are normalized; valid foreign E.164
  /// numbers are restored with their detected country. Unparseable or
  /// non-mobile values are preserved as the national number with PH as the
  /// fallback country so the user can review and correct them, with a warning.
  void _restoreStoredPhone(String? storedPhone) {
    final trimmed = storedPhone?.trim() ?? '';
    if (trimmed.isEmpty) {
      _selectedCountry = IsoCode.PH;
      _nationalNumber = '';
      _phoneRestoreWarning = null;
      return;
    }

    // International E.164 form: detect the country from the leading +.
    if (trimmed.startsWith('+')) {
      try {
        final parsed = PhoneNumber.parse(trimmed);
        if (parsed.isValid()) {
          final isMobile = parsed.isValid(type: PhoneNumberType.mobile);
          final isFixedLine = parsed.isValid(type: PhoneNumberType.fixedLine);
          // Patient fields accept mobile numbers only. Preserve landlines,
          // ambiguous fixed-line-or-mobile, VoIP, toll-free, premium-rate and
          // other non-mobile values for review with a warning.
          if (isMobile && !isFixedLine) {
            _selectedCountry = parsed.isoCode;
            _nationalNumber = parsed.nsn;
            _phoneRestoreWarning = null;
            return;
          }
        }
      } catch (_) {}
      _selectedCountry = IsoCode.PH;
      _nationalNumber = trimmed;
      _phoneRestoreWarning = _storedPhoneWarning;
      return;
    }

    // Assume Philippine domestic or national form.
    _selectedCountry = IsoCode.PH;
    final result = parsePhone(trimmed);
    if (result.ok && result.kind == PhoneKind.mobile && result.e164 != null) {
      _nationalNumber = result.e164!.substring(phCountryCode.length + 1);
      _phoneRestoreWarning = null;
    } else {
      // Preserve unparseable/invalid values for review and editing.
      _nationalNumber = trimmed;
      _phoneRestoreWarning = _storedPhoneWarning;
    }
  }

  Future<void> _submitDetails() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final phoneState = _phoneInputKey.currentState;
    if (phoneState == null || !phoneState.isValid) {
      setState(() {
        _phoneInputError = phoneState?.errorText ?? 'Mobile number is required.';
      });
      return;
    }

    final phone = phoneState.e164;
    if (phone == null) {
      setState(() {
        _phoneInputError = 'Enter a valid mobile number.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.submitPatientDetails(
        doctorId: widget.doctorId,
        firstName: _firstNameController.text.trim(),
        middleName: _middleNameController.text.trim().isEmpty
            ? null
            : _middleNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        dateOfBirth: _dateOfBirthController.text.trim(),
        sex: _selectedSex,
        phone: phone,
        address: _addressController.text.trim(),
      );

      if (response['success'] == true) {
        if (mounted) {
          // Navigate to booking confirmation with preserved state
          Navigator.of(context).pushReplacementNamed(
            '/booking-confirmation',
            arguments: {
              'doctorId': widget.doctorId,
              'doctorName': widget.doctorName,
              'specialty': widget.specialty,
              'clinic': widget.clinic,
              'consultationFee': widget.consultationFee,
              'selectedDate': widget.selectedDate,
              'paymentMethod': widget.paymentMethod,
              'professionalPhotoUrl': widget.professionalPhotoUrl,
            },
          );
        }
      } else {
        setState(() {
          _errorMessage =
              response['error']?['message'] ?? 'Failed to submit details';
          _isSubmitting = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to submit details: $e';
        _isSubmitting = false;
      });
    }
  }

  Future<void> _selectDateOfBirth() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );

    if (picked != null) {
      setState(() {
        _dateOfBirthController.text = DateFormat('yyyy-MM-dd').format(picked);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          AppHeader(
            showBackButton: true,
            onBackPressed: () => Navigator.of(context).pop(),
            showNotifications: false,
            showProfile: false,
          ),
          Expanded(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    if (_isLoading)
                      _buildLoadingState()
                    else if (_errorMessage != null && _isSubmitting == false)
                      _buildErrorState()
                    else
                      _buildForm(),
                  ],
                ),
              ),
            ),
          ),
          if (!_isLoading) _buildBottomButton(),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return const FormFieldsSkeleton(fieldCount: 6);
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32.0),
        child: Column(
          children: [
            Icon(Icons.error_outline, size: 64, color: AppColors.error),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.error),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadPatientProfile,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCard(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Please complete your details',
                  style: AppTextStyles.bodyMd.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  'These details are required before booking with ${widget.doctorName ?? 'this doctor'}',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),

          // Email (non-editable)
          if (_email != null) ...[
            CustomTextField(
              label: 'Email Address',
              hint: 'your.email@example.com',
              controller: TextEditingController(text: _email),
              enabled: false,
              keyboardType: TextInputType.emailAddress,
              prefixIcon: Icons.email,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
          ],

          // First Name
          CustomTextField(
            label: 'First Name *',
            hint: 'Enter your first name',
            controller: _firstNameController,
            keyboardType: TextInputType.name,
            textCapitalization: TextCapitalization.words,
            prefixIcon: Icons.person,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'First name is required';
              }
              if (value.trim().length > 100) {
                return 'First name must be 1-100 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Middle Name (optional)
          CustomTextField(
            label: 'Middle Name (Optional)',
            hint: 'Enter your middle name',
            controller: _middleNameController,
            keyboardType: TextInputType.name,
            textCapitalization: TextCapitalization.words,
            prefixIcon: Icons.person_outline,
            validator: (value) {
              if (value != null &&
                  value.trim().isNotEmpty &&
                  value.trim().length > 100) {
                return 'Middle name must be maximum 100 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Last Name
          CustomTextField(
            label: 'Last Name *',
            hint: 'Enter your last name',
            controller: _lastNameController,
            keyboardType: TextInputType.name,
            textCapitalization: TextCapitalization.words,
            prefixIcon: Icons.person,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Last name is required';
              }
              if (value.trim().length > 100) {
                return 'Last name must be 1-100 characters';
              }
              return null;
            },
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Date of Birth
          CustomTextField(
            label: 'Date of Birth *',
            hint: 'YYYY-MM-DD',
            controller: _dateOfBirthController,
            keyboardType: TextInputType.datetime,
            prefixIcon: Icons.calendar_today,
            readOnly: true,
            onTap: _selectDateOfBirth,
            suffixIcon: const Icon(Icons.calendar_month),
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
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Sex
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Sex *', style: AppTextStyles.inputLabel),
              const SizedBox(height: spacing.AppSpacing.gutterXs),
              DropdownButtonFormField<String>(
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.surfaceLowest,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterLg,
                    vertical: spacing.AppSpacing.gutterMd,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusLg,
                    ),
                    borderSide: BorderSide(color: AppColors.slate300),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusLg,
                    ),
                    borderSide: BorderSide(color: AppColors.slate300),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusLg,
                    ),
                    borderSide: BorderSide(color: AppColors.primary, width: 2),
                  ),
                ),
                items: _sexOptions.map((String sex) {
                  return DropdownMenuItem<String>(value: sex, child: Text(sex));
                }).toList(),
                onChanged: (String? newValue) {
                  setState(() {
                    _selectedSex = newValue ?? 'NOT_SPECIFIED';
                  });
                },
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Sex is required';
                  }
                  return null;
                },
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Mobile Number
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              InternationalPhoneInput(
                key: _phoneInputKey,
                country: _selectedCountry,
                nationalNumber: _nationalNumber,
                onCountryChanged: (c) => setState(() {
                  _selectedCountry = c;
                  _phoneInputError = null;
                  _phoneRestoreWarning = null;
                }),
                onNationalChanged: (n) => setState(() {
                  _nationalNumber = n;
                  _phoneInputError = null;
                  _phoneRestoreWarning = null;
                }),
                allowLandline: false,
                labelText: 'Mobile Number *',
                hintText: '9XX XXX XXXX',
                requiredField: true,
                errorText: _phoneInputError,
                enabled: !_isSubmitting,
              ),
              if (_phoneInputError != null) ...[
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  _phoneInputError!,
                  style: AppTextStyles.bodySm.copyWith(color: AppColors.error),
                ),
              ],
              if (_phoneRestoreWarning != null) ...[
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  _phoneRestoreWarning!,
                  style: AppTextStyles.bodySm.copyWith(
                    color: AppColors.slate600,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Address
          CustomTextField(
            label: 'Address *',
            hint: 'Enter your full address',
            controller: _addressController,
            keyboardType: TextInputType.streetAddress,
            textCapitalization: TextCapitalization.sentences,
            maxLines: 3,
            prefixIcon: Icons.location_on,
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return 'Address is required';
              }
              return null;
            },
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),

          if (_errorMessage != null && _isSubmitting)
            Container(
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                color: AppColors.errorContainer,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusLg,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.error_outline,
                    color: AppColors.error,
                    size: spacing.AppSpacing.iconMd,
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.error,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBottomButton() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: PrimaryButton(
        text: _isSubmitting ? 'Submitting...' : 'Continue to Booking',
        onPressed: _isSubmitting ? null : _submitDetails,
      ),
    );
  }
}
