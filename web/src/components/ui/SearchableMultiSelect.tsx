'use client';

import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { usePresence } from '@/hooks/usePresence';

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableMultiSelectProps {
  id?: string;
  value: string[]; // array of selected values e.g. ['MD', 'FPCP']
  onChange: (value: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  noResultsText?: string;
}

export default function SearchableMultiSelect({
  id: externalId,
  value,
  onChange,
  options,
  placeholder = 'Search & select credentials...',
  error,
  disabled = false,
  noResultsText = 'No matching credentials found',
}: SearchableMultiSelectProps) {
  const generatedId = useId();
  const id = externalId || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const dropdownPresent = usePresence(isOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((opt) => {
      const matchValue = opt.value.toLowerCase().includes(query);
      const matchLabel = opt.label.toLowerCase().includes(query);
      const matchDesc = opt.description?.toLowerCase().includes(query);
      return matchValue || matchLabel || matchDesc;
    });
  }, [options, searchQuery]);

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

  const toggleSelect = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
    setSearchQuery('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const removeValue = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== val));
    inputRef.current?.focus();
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
    setSearchQuery('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
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
        toggleSelect(filteredOptions[highlightedIndex].value);
      } else if (filteredOptions.length === 1) {
        toggleSelect(filteredOptions[0].value);
      }
    } else if (e.key === 'Backspace' && searchQuery === '' && value.length > 0) {
      // Remove last tag on Backspace when query is empty
      onChange(value.slice(0, -1));
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
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`min-h-[44px] w-full rounded-lg border ${
          error ? 'border-red-500' : 'border-slate-200'
        } bg-white py-2 px-3 flex flex-wrap items-center gap-1.5 cursor-text transition-colors focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500 ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''
        }`}
      >
        {/* Selected Value Chips */}
        {value.map((val) => {
          const opt = options.find((o) => o.value === val);
          const displayLabel = opt ? opt.label : val;

          return (
            <span
              key={val}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[13px] font-semibold border border-emerald-100 shadow-xs"
            >
              <span>{displayLabel}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeValue(val, e)}
                  aria-label={`Remove ${displayLabel}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </span>
          );
        })}

        {/* Search Input */}
        <div className="flex-1 min-w-[120px] flex items-center">
          <input
            ref={inputRef}
            id={id}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={`${id}-multiselect-listbox`}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => {
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : 'Add another credential...'}
            className="w-full bg-transparent border-0 py-1 px-1 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-0"
          />
        </div>

        {/* Clear All & Chevron */}
        <div className="flex items-center gap-1 ml-auto self-center pointer-events-auto">
          {value.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Clear all credentials"
              tabIndex={-1}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              if (isOpen) {
                setIsOpen(false);
              } else {
                setIsOpen(true);
                inputRef.current?.focus();
              }
            }}
            tabIndex={-1}
            className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
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

      {dropdownPresent && (
        <ul
          id={`${id}-multiselect-listbox`}
          ref={listRef}
          role="listbox"
          aria-multiselectable="true"
          tabIndex={-1}
          data-state={isOpen ? 'open' : 'closed'}
          className="fmd-dropdown absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg bg-white shadow-xl border border-slate-200 focus:outline-none"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-4 py-3 text-center text-sm text-slate-400">
              {noResultsText}
            </li>
          ) : (
            filteredOptions.map((opt, index) => {
              const isSelected = value.includes(opt.value);
              const isHighlighted = index === highlightedIndex;

              return (
                <li
                  key={opt.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(opt.value);
                  }}
                  className={`flex items-center justify-between px-4 py-2 cursor-pointer text-sm transition-colors ${
                    isHighlighted || isSelected
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{opt.label}</span>
                      {opt.description && (
                        <span className="text-xs text-slate-500 truncate">
                          - {opt.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
