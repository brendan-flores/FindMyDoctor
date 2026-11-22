'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePresence } from '@/hooks/usePresence';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  error,
  disabled = false,
  className = '',
  triggerClassName = '',
  id,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownPresent = usePresence(isOpen);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value || placeholder;

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        data-dropdown
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-left flex items-center justify-between bg-white transition-colors ${
          error
            ? 'border-red-500 focus:ring-red-500'
            : 'border-slate-200 focus:ring-emerald-500 hover:border-emerald-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''} ${triggerClassName}`}
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdownPresent && (
        <div
          data-dropdown-content
          data-state={isOpen ? 'open' : 'closed'}
          className="fmd-dropdown absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={opt.disabled}
              onClick={() => handleSelect(opt.value)}
              className={`w-full px-4 py-2 text-left hover:bg-emerald-50 hover:text-emerald-700 transition-colors truncate first:rounded-t-lg last:rounded-b-lg ${
                opt.value === value ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700'
              } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
