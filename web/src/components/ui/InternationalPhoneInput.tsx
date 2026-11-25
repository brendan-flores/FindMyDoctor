'use client';

import React from 'react';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js/max';
import { splitInternationalInput } from '@/lib/phone';

export interface InternationalPhoneInputProps {
  country: string;
  nationalNumber: string;
  onCountryChange: (iso: string) => void;
  onNationalChange: (value: string) => void;
  label?: string;
  required?: boolean;
  placeholder?: string;
  error?: string | null;
  id?: string;
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const countryOptions = getCountries()
  .map((iso) => ({
    iso,
    name: displayNames.of(iso) || iso,
    callingCode: getCountryCallingCode(iso),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function InternationalPhoneInput({
  country,
  nationalNumber,
  onCountryChange,
  onNationalChange,
  label,
  required,
  placeholder,
  error,
  id,
}: InternationalPhoneInputProps) {
  const selected = countryOptions.find((c) => c.iso === country) || countryOptions.find((c) => c.iso === 'PH')!;

  const applyInternational = (value: string): boolean => {
    const split = splitInternationalInput(value, selected.iso);
    if (!split) return false;
    onCountryChange(split.country);
    onNationalChange(split.nationalNumber);
    return true;
  };

  const handleNationalChange = (value: string) => {
    // Typing a leading plus is the start of an international number.
    if (value.trim().startsWith('+') && applyInternational(value)) return;
    onNationalChange(value);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    // Pasting a complete international number selects its country and keeps
    // only the national portion, so a country code can never be doubled.
    if (applyInternational(pasted)) event.preventDefault();
  };

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm text-neutral-500 mb-1">
          {label}{required ? ' *' : ''}
        </label>
      )}
      <div className="flex gap-2">
        <select
          id={id ? `${id}-country` : undefined}
          aria-label="Country"
          value={selected.iso}
          onChange={(e) => onCountryChange(e.target.value)}
          className="border border-neutral-200 rounded-lg px-2 py-2 bg-white"
        >
          {countryOptions.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.callingCode})
            </option>
          ))}
        </select>
        <input
          id={id}
          type="text"
          inputMode="tel"
          value={nationalNumber}
          onChange={(e) => handleNationalChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder || 'National number'}
          required={required}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            error ? 'border-error-500 focus:ring-error-500' : 'border-neutral-200 focus:ring-primary-600'
          }`}
        />
      </div>
      {error && (
        <p id={id ? `${id}-error` : undefined} className="text-xs text-error-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}
