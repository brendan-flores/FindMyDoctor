'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const selected = countryOptions.find((c) => c.iso === country) || countryOptions.find((c) => c.iso === 'PH')!;

  const menuItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []
    );

  const openMenu = (focusLast = false) => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      const items = menuItems();
      if (items.length > 0) {
        items[focusLast ? items.length - 1 : 0].focus();
      }
    });
  };

  const closeMenu = (returnFocus = true) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = menuItems();
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusItem = (item?: HTMLElement) => {
      item?.focus();
      item?.scrollIntoView({ block: 'nearest' });
    };
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(items[index === -1 ? 0 : (index + 1) % items.length]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(items[index === -1 ? items.length - 1 : (index - 1 + items.length) % items.length]);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(items[0]);
        break;
      case 'End':
        event.preventDefault();
        focusItem(items[items.length - 1]);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        break;
      case 'Tab':
        // Items unmount with the menu, so move focus explicitly: forward
        // goes to the national-number input, backward to the trigger.
        event.preventDefault();
        setIsOpen(false);
        if (event.shiftKey) {
          triggerRef.current?.focus();
        } else {
          inputRef.current?.focus();
        }
        break;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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

  const resolvedPlaceholder =
    placeholder ?? (selected.iso === 'PH' ? '9XX XXX XXXX' : 'National number');

  return (
    <div className="w-full" ref={rootRef}>
      {label && (
        <label htmlFor={id} className="block text-sm text-neutral-500 mb-1">
          {label}{required ? ' *' : ''}
        </label>
      )}
      <div className="flex gap-2">
        <div className="relative shrink-0">
          <button
            ref={triggerRef}
            type="button"
            id={id ? `${id}-country` : undefined}
            aria-label={`Country calling code: +${selected.callingCode} (${selected.name})`}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={menuId}
            onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                openMenu();
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                openMenu(true);
              }
            }}
            className="h-10 w-20 flex items-center justify-between gap-1 border border-neutral-200 rounded-lg px-2 bg-white text-sm text-neutral-700 hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            <span className="truncate">+{selected.callingCode}</span>
            <svg
              className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isOpen && (
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Country"
              onKeyDown={handleMenuKeyDown}
              className="absolute left-0 top-full z-50 mt-1 max-h-60 w-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-xl"
            >
              {countryOptions.map((c) => (
                <button
                  key={c.iso}
                  type="button"
                  role="menuitemradio"
                  aria-checked={c.iso === selected.iso}
                  tabIndex={-1}
                  onClick={() => {
                    onCountryChange(c.iso);
                    closeMenu();
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 transition-colors ${
                    c.iso === selected.iso ? 'text-primary-700 font-medium' : 'text-neutral-700'
                  }`}
                >
                  {c.name} <span className="text-neutral-400">(+{c.callingCode})</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="tel"
          value={nationalNumber}
          onChange={(e) => handleNationalChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={resolvedPlaceholder}
          required={required}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-10 flex-1 px-3 border rounded-lg focus:outline-none focus:ring-2 ${
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
