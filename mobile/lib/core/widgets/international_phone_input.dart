import 'package:flutter/material.dart';
import 'package:phone_numbers_parser/phone_numbers_parser.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import '../theme/app_text_styles.dart';
import '../utils/country_names.dart';
import '../utils/phone_input.dart';
import '../utils/phone_input_form.dart';

class InternationalPhoneInput extends StatefulWidget {
  final IsoCode country;
  final String nationalNumber;
  final ValueChanged<IsoCode> onCountryChanged;
  final ValueChanged<String> onNationalChanged;
  final bool allowLandline;
  final String? labelText;
  final String? hintText;
  final String? errorText;
  final bool requiredField;
  final bool enabled;

  const InternationalPhoneInput({
    super.key,
    required this.country,
    required this.nationalNumber,
    required this.onCountryChanged,
    required this.onNationalChanged,
    this.allowLandline = false,
    this.labelText,
    this.hintText,
    this.errorText,
    this.requiredField = false,
    this.enabled = true,
  });

  @override
  InternationalPhoneInputState createState() => InternationalPhoneInputState();
}

class InternationalPhoneInputState extends State<InternationalPhoneInput> {
  late final TextEditingController _controller;
  String? _validationError;
  String? _e164;
  bool _isProgrammaticChange = false;
  bool _touched = false;

  String? get errorText => _validationError ?? widget.errorText;
  String? get e164 => _e164;
  bool get isValid =>
      _validationError == null &&
      (!widget.requiredField || _controller.text.trim().isNotEmpty);

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.nationalNumber);
    // Validate a restored value on mount so its E.164 form is ready for
    // submit. An empty required field stays quiet until the user interacts
    // or the parent attempts submission (isValid still reports it invalid).
    if (widget.nationalNumber.trim().isNotEmpty) {
      _validate();
    }
  }

  @override
  void didUpdateWidget(covariant InternationalPhoneInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nationalChanged = oldWidget.nationalNumber != widget.nationalNumber;
    final countryChanged = oldWidget.country != widget.country;
    if (nationalChanged &&
        _controller.text != widget.nationalNumber &&
        !_isProgrammaticChange) {
      _controller.text = widget.nationalNumber;
      _controller.selection = TextSelection.collapsed(offset: _controller.text.length);
    }
    // Programmatic changes (profile restore, paste split, country switch)
    // must refresh validation and the E.164 value, not just the text.
    if (nationalChanged || countryChanged) {
      _validate();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _callingCode(IsoCode c) {
    try {
      return PhoneNumber(isoCode: c, nsn: '').countryCode;
    } catch (_) {
      return '';
    }
  }

  void _validate({IsoCode? country}) {
    final selectedCountry = country ?? widget.country;
    final national = _controller.text.trim();
    if (national.isEmpty) {
      setState(() {
        _validationError = widget.requiredField && _touched
            ? 'Mobile number is required'
            : null;
        _e164 = null;
      });
      return;
    }
    if (selectedCountry == IsoCode.PH) {
      _validatePhilippine(national);
    } else {
      _validateInternational(national, selectedCountry);
    }
  }

  void _validatePhilippine(String national) {
    final result = parsePhone(national);
    if (!result.ok) {
      setState(() {
        _validationError = phoneParseErrorMessage(result.error!);
        _e164 = null;
      });
      return;
    }
    if (result.kind == PhoneKind.mobile) {
      setState(() {
        _validationError = null;
        _e164 = result.e164;
      });
      return;
    }
    // `allowLandline` has real validation behaviour: a recognised Philippine
    // landline is accepted only when the caller opted in. Patient mobile fields
    // leave it false, so landlines are rejected here.
    if (widget.allowLandline && result.kind == PhoneKind.landline) {
      setState(() {
        _validationError = null;
        _e164 = result.e164;
      });
      return;
    }
    setState(() {
      _validationError = 'Enter a valid mobile number.';
      _e164 = null;
    });
  }

  void _validateInternational(String national, [IsoCode? country]) {
    final selectedCountry = country ?? widget.country;
    try {
      final countryCode = PhoneNumber(isoCode: selectedCountry, nsn: '').countryCode;
      final parsed = PhoneNumber.parse('+$countryCode$national');
      final isMobile = parsed.isValid(type: PhoneNumberType.mobile);
      final isFixedLine = parsed.isValid(type: PhoneNumberType.fixedLine);
      final ambiguous = isMobile && isFixedLine;

      // Ambiguous fixed-line-or-mobile numbers are never accepted for these
      // patient fields, even when landlines are allowed.
      if (ambiguous) {
        setState(() {
          _validationError = 'Enter a valid mobile number.';
          _e164 = null;
        });
        return;
      }

      if (isMobile && !isFixedLine) {
        setState(() {
          _validationError = null;
          _e164 = parsed.international;
        });
        return;
      }

      if (widget.allowLandline && isFixedLine && !isMobile) {
        setState(() {
          _validationError = null;
          _e164 = parsed.international;
        });
        return;
      }

      setState(() {
        _validationError = 'Enter a valid mobile number.';
        _e164 = null;
      });
    } catch (_) {
      setState(() {
        _validationError = 'Enter a valid mobile number.';
        _e164 = null;
      });
    }
  }

  /// Keeps the controller and the parent form in sync after an international
  /// value could not be accepted: the raw text stays in the field so the user
  /// can correct it, the parent receives the same value, and the normal
  /// validation path reports why it was rejected.
  void _rejectInternational(String text) {
    widget.onNationalChanged(text);
    _validate();
  }

  /// Philippine `+63` input is validated by the shared Philippine parser so
  /// paste handling applies exactly the same rules as typing and restore.
  void _acceptPhilippineInternational(String text) {
    final result = parsePhone(text);
    final accepted = result.ok &&
        result.e164 != null &&
        (result.kind == PhoneKind.mobile ||
            (widget.allowLandline && result.kind == PhoneKind.landline));
    if (!accepted) {
      _rejectInternational(text);
      return;
    }
    final nsn = result.e164!.substring(phCountryCode.length + 1);
    _isProgrammaticChange = true;
    widget.onCountryChanged(IsoCode.PH);
    widget.onNationalChanged(nsn);
    _controller.text = nsn;
    _controller.selection = TextSelection.collapsed(offset: nsn.length);
    _isProgrammaticChange = false;
    _validate(country: IsoCode.PH);
  }

  void _handleInternationalPaste(String text) {
    _touched = true;
    // Philippine `+63` input always goes through the shared Philippine
    // parser: it is the authoritative rule set for PH numbers and accepts
    // shapes the generic parser rejects (e.g. landlines when allowed).
    final trimmed = text.trim();
    if (trimmed.startsWith('+') &&
        trimmed.substring(1).startsWith(phCountryCode)) {
      _acceptPhilippineInternational(trimmed);
      return;
    }
    try {
      final parsed = PhoneNumber.parse(text);
      if (parsed.isValid()) {
        if (parsed.isoCode == IsoCode.PH) {
          _acceptPhilippineInternational(text);
          return;
        }
        final isMobile = parsed.isValid(type: PhoneNumberType.mobile);
        final isFixedLine = parsed.isValid(type: PhoneNumberType.fixedLine);
        final ambiguous = isMobile && isFixedLine;
        final accepted = !ambiguous &&
            ((isMobile && !isFixedLine) ||
                (widget.allowLandline && isFixedLine && !isMobile));
        if (accepted) {
          _isProgrammaticChange = true;
          widget.onCountryChanged(parsed.isoCode);
          widget.onNationalChanged(parsed.nsn);
          _controller.text = parsed.nsn;
          _controller.selection =
              TextSelection.collapsed(offset: parsed.nsn.length);
          _isProgrammaticChange = false;
          _validate(country: parsed.isoCode);
          return;
        }
      }
    } catch (_) {}
    _rejectInternational(text);
  }

  OutlineInputBorder _outlineBorder(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasError = errorText != null;
    final borderColor = hasError
        ? AppColors.error
        : (widget.enabled ? AppColors.slate300 : AppColors.slate200);
    final fieldDecoration = InputDecoration(
      filled: true,
      fillColor: AppColors.surfaceLowest,
      contentPadding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterLg,
        vertical: spacing.AppSpacing.gutterMd,
      ),
      border: _outlineBorder(borderColor),
      enabledBorder: _outlineBorder(borderColor),
      disabledBorder: _outlineBorder(AppColors.slate200),
      focusedBorder: _outlineBorder(
        hasError ? AppColors.error : AppColors.primary,
        width: 2,
      ),
      errorBorder: _outlineBorder(AppColors.error),
      focusedErrorBorder: _outlineBorder(AppColors.error, width: 2),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.labelText != null) ...[
          Text(
            widget.requiredField
                ? '${widget.labelText} *'
                : widget.labelText!,
            style: AppTextStyles.inputLabel,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 112,
              child: InputDecorator(
              decoration: fieldDecoration,
              child: PopupMenuButton<IsoCode>(
                tooltip:
                    '${countryNames[widget.country.name] ?? widget.country.name} (+${_callingCode(widget.country)})',
                padding: EdgeInsets.zero,
                enabled: widget.enabled,
                onSelected: (v) {
                  _touched = true;
                  final current = _controller.text;
                  widget.onCountryChanged(v);
                  widget.onNationalChanged(current);
                  _validate(country: v);
                },
                itemBuilder: (context) => IsoCode.values
                    .map((c) => PopupMenuItem<IsoCode>(
                          value: c,
                          child: Text(
                            '${countryNames[c.name] ?? c.name} (+${_callingCode(c)})',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ))
                    .toList(),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        '+${_callingCode(widget.country)}',
                        style: AppTextStyles.inputText,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Icon(
                      Icons.keyboard_arrow_down,
                      color: AppColors.slate400,
                      size: spacing.AppSpacing.iconSm,
                    ),
                  ],
                ),
              ),
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: TextField(
                controller: _controller,
                keyboardType: TextInputType.phone,
                enabled: widget.enabled,
                onChanged: (value) {
                  _touched = true;
                  if (_isProgrammaticChange) return;
                  if (value.startsWith('+')) {
                    _handleInternationalPaste(value);
                    return;
                  }
                  widget.onNationalChanged(value);
                  _validate();
                },
                style: AppTextStyles.inputText,
                decoration: fieldDecoration.copyWith(
                  hintText: widget.hintText ??
                      (widget.country == IsoCode.PH
                          ? '9XX XXX XXXX'
                          : 'National number'),
                  hintStyle: AppTextStyles.inputPlaceholder,
                  errorText: errorText,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
