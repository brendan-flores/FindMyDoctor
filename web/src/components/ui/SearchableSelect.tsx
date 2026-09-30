'use client';

import React, { useState, useRef, useEffect, useId, useMemo } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  noResultsText?: string;
}

export default function SearchableSelect({
  id: externalId,
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  error,
  disabled = false,
  noResultsText = 'No matching options found',
}: SearchableSelectProps) {
  const generatedId = useId();
  const id = externalId || generatedId;

  // Normalized option objects
  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return normalizedOptions;
    }
    return normalizedOptions.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchSub = opt.sublabel?.toLowerCase().includes(query);
      return matchLabel || matchSub;
    });
  }, [normalizedOptions, searchQuery]);

  // Current selected option label
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value);
  }, [normalizedOptions, value]);

  // When value changes from outside, reset query if not open
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [value, isOpen]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const activeElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(0);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (filteredOptions.length === 1) {
        handleSelect(filteredOptions[0].value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={isOpen ? searchQuery : selectedOption ? selectedOption.label : ''}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(
              selectedOption
                ? filteredOptions.findIndex((o) => o.value === selectedOption.value)
                : 0
            );
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          className={`block w-full rounded-2xl border ${
            error ? 'border-red-500' : 'border-[#E2E8F0]'
          } bg-white py-3.5 pl-4 pr-14 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all overflow-hidden text-ellipsis whitespace-nowrap ${
            disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'
          }`}
        />

        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-auto">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[#94A3B8] hover:text-[#475569] p-0.5 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Clear selection"
              tabIndex={-1}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              if (isOpen) {
                setIsOpen(false);
              } else {
                setIsOpen(true);
                inputRef.current?.focus();
              }
            }}
            tabIndex={-1}
            className="text-[#94A3B8] hover:text-[#475569] p-0.5 transition-colors"
            aria-label="Toggle dropdown"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {isOpen && (
        <ul
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-2xl bg-white p-1.5 shadow-xl border border-[#E2E8F0] focus:outline-none"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-4 py-3 text-center text-sm text-[#94A3B8]">
              {noResultsText}
            </li>
          ) : (
            filteredOptions.map((opt, index) => {
              const isSelected = opt.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <li
                  key={opt.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer text-[14px] transition-colors ${
                    isHighlighted
                      ? 'bg-[#F1F5F9] text-[#0F172A]'
                      : isSelected
                      ? 'bg-[#EBF3FC] text-[#165CBE] font-medium'
                      : 'text-[#334155] hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[12px] text-[#8392A5] truncate">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <svg
                      className="w-4 h-4 text-[#165CBE] shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
