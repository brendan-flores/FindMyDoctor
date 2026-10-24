'use client';

import { useState, useEffect } from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
}

export default function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: OtpInputProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/\D/g, '').slice(0, 1);
    const otpArray = value.split('');
    otpArray[index] = newValue;
    const newOtp = otpArray.join('');

    onChange(newOtp);

    if (newValue && index < length - 1) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    } else if (!newValue && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }

    if (newOtp.length === length && onComplete) {
      onComplete(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const digits = pastedText.replace(/\D/g, '').slice(0, length);
    
    if (digits.length === length) {
      onChange(digits);
      if (onComplete) {
        onComplete(digits);
      }
    }
  };

  const getBorderColor = (index: number, hasValue: boolean) => {
    if (error) return 'border-red-500';
    if (focusedIndex === index) return 'border-[#1A62CD]';
    if (hasValue) return 'border-[#1A62CD]';
    return 'border-[#E2E8F0]';
  };

  const getBgColor = (index: number, hasValue: boolean) => {
    if (error) return 'bg-red-50';
    if (focusedIndex === index) return 'bg-white';
    if (hasValue) return 'bg-[#1A62CD]/5';
    return 'bg-white';
  };

  return (
    <div className="flex flex-col items-center gap-2" onPaste={handlePaste}>
      <label className="text-[15px] font-bold text-[#1A202C]">
        Verification Code
      </label>
      <div className="flex gap-2">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(null)}
            disabled={disabled}
            className={`w-14 h-14 text-center text-2xl font-bold text-[#0D1829] rounded-xl border-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 disabled:opacity-50 disabled:cursor-not-allowed ${getBorderColor(index, !!value[index])} ${getBgColor(index, !!value[index])}`}
          />
        ))}
      </div>
    </div>
  );
}
