import 'package:flutter/material.dart';
import 'package:phone_numbers_parser/phone_numbers_parser.dart';

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

  String? get errorText => _validationError ?? widget.errorText;
  String? get e164 => _e164;
  bool get isValid =>
      _validationError == null && (!widget.requiredField || _controller.text.isNotEmpty);

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.nationalNumber);
    // Validate on mount so a required empty field shows its error immediately
    // instead of waiting for the first keystroke.
    _validate();
  }

  @override
  void didUpdateWidget(covariant InternationalPhoneInput oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.nationalNumber != widget.nationalNumber &&
        _controller.text != widget.nationalNumber &&
        !_isProgrammaticChange) {
      _controller.text = widget.nationalNumber;
      _controller.selection = TextSelection.collapsed(offset: _controller.text.length);
    }
    if (oldWidget.country != widget.country) {
      _validate(country: widget.country);
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
        _validationError = widget.requiredField ? 'Mobile number is required' : null;
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

  void _handleInternationalPaste(String text) {
    try {
      final parsed = PhoneNumber.parse(text);
      if (!parsed.isValid()) {
        setState(() {
          _validationError = 'Enter a valid mobile number.';
          _e164 = null;
        });
        return;
      }
      final isMobile = parsed.isValid(type: PhoneNumberType.mobile);
      final isFixedLine = parsed.isValid(type: PhoneNumberType.fixedLine);
      final ambiguous = isMobile && isFixedLine;
      final accepted = !ambiguous &&
          ((isMobile && !isFixedLine) ||
              (widget.allowLandline && isFixedLine && !isMobile));
      if (!accepted) {
        setState(() {
          _validationError = 'Enter a valid mobile number.';
          _e164 = null;
        });
        return;
      }
      _isProgrammaticChange = true;
      widget.onCountryChanged(parsed.isoCode);
      widget.onNationalChanged(parsed.nsn);
      _controller.text = parsed.nsn;
      _controller.selection =
          TextSelection.collapsed(offset: parsed.nsn.length);
      _isProgrammaticChange = false;
      _validate(country: parsed.isoCode);
    } catch (_) {
      setState(() {
        _validationError = 'Enter a valid mobile number.';
        _e164 = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.labelText != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              widget.requiredField ? '${widget.labelText} *' : widget.labelText!,
            ),
          ),
        Row(
          children: [
            SizedBox(
              width: 160,
              child: DropdownButton<IsoCode>(
                isExpanded: true,
                value: widget.country,
                items: IsoCode.values
                    .map((c) => DropdownMenuItem<IsoCode>(
                          value: c,
                          child: Text(
                            '${countryNames[c.name] ?? c.name} (+${_callingCode(c)})',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ))
                    .toList(),
              onChanged: widget.enabled
                  ? (v) {
                      if (v == null) return;
                      final current = _controller.text;
                      _validationError = null;
                      _e164 = null;
                      widget.onCountryChanged(v);
                      widget.onNationalChanged(current);
                      _validate(country: v);
                    }
                  : null,
             ),
             ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _controller,
                keyboardType: TextInputType.phone,
                enabled: widget.enabled,
                onChanged: (value) {
                  if (_isProgrammaticChange) return;
                  if (value.startsWith('+')) {
                    _handleInternationalPaste(value);
                    return;
                  }
                  widget.onNationalChanged(value);
                  _validate();
                },
                decoration: InputDecoration(
                  hintText: widget.hintText ?? 'National number',
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
