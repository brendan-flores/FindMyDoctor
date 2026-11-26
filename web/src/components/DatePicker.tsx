'use client';

import { useState, useEffect, useRef } from 'react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  maxDate?: string;
  minDate?: string;
  disabledDates?: string[];
  placeholder?: string;
  label?: string;
  showClear?: boolean;
  showToday?: boolean;
  className?: string;
  onOpen?: () => void;
  popupPosition?: 'left' | 'right';
}

const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export default function DatePicker({
  value,
  onChange,
  maxDate,
  minDate,
  disabledDates,
  placeholder = 'Select date',
  label,
  showClear = false,
  showToday = false,
  onOpen,
  popupPosition,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openDirection, setOpenDirection] = useState<'up' | 'down'>('down');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const maxDateObj = parseDate(maxDate);
  const minDateObj = parseDate(minDate);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = parseDate(value) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(parseDate(value));
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [showMonthSelector, setShowMonthSelector] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const d = parseDate(value) || new Date();
      setSelectedDate(parseDate(value));
      setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      setShowYearSelector(false);
      setShowMonthSelector(false);
    }
  }, [isOpen, value]);

  useEffect(() => {
    setSelectedDate(parseDate(value));
  }, [value]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const currentYear = new Date().getFullYear();
  const minYear = minDateObj ? minDateObj.getFullYear() : currentYear - 100;
  const maxYear = maxDateObj ? maxDateObj.getFullYear() : currentYear + 10;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const isMaxMonth = () => {
    if (!maxDateObj) return false;
    const cy = currentMonth.getFullYear();
    const cm = currentMonth.getMonth();
    if (cy > maxDateObj.getFullYear()) return true;
    if (cy === maxDateObj.getFullYear() && cm >= maxDateObj.getMonth()) return true;
    return false;
  };
  const isMinMonth = () => {
    if (!minDateObj) return false;
    const cy = currentMonth.getFullYear();
    const cm = currentMonth.getMonth();
    if (cy < minDateObj.getFullYear()) return true;
    if (cy === minDateObj.getFullYear() && cm <= minDateObj.getMonth()) return true;
    return false;
  };

  const goToPreviousMonth = () => {
    if (isMinMonth()) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    if (isMaxMonth()) return;
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isDisabled = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = toLocalDateStr(date);
    if (maxDateObj && date > maxDateObj) return true;
    if (minDateObj && date < minDateObj) return true;
    if (disabledDates?.includes(dateStr)) return true;
    return false;
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    onChange(toLocalDateStr(newDate));
    setSelectedDate(newDate);
    setIsOpen(false);
  };

  const handleYearChange = (year: number) => {
    let month = currentMonth.getMonth();
    // clamp month to valid range for selected year
    if (minDateObj && year === minDateObj.getFullYear() && month < minDateObj.getMonth()) month = minDateObj.getMonth();
    if (maxDateObj && year === maxDateObj.getFullYear() && month > maxDateObj.getMonth()) month = maxDateObj.getMonth();
    setCurrentMonth(new Date(year, month, 1));
    setShowYearSelector(false);
  };
  const handleMonthChange = (monthIndex: number) => {
    const year = currentMonth.getFullYear();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    if (minDateObj && lastDay < minDateObj) return;
    if (maxDateObj && firstDay > maxDateObj) return;
    setCurrentMonth(new Date(year, monthIndex, 1));
    setShowMonthSelector(false);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear();
  };
  const isSelected = (day: number) => {
    return selectedDate && day === selectedDate.getDate() && currentMonth.getMonth() === selectedDate.getMonth() && currentMonth.getFullYear() === selectedDate.getFullYear();
  };

  const isTodayDisabled = () => {
    const today = new Date();
    const todayStr = toLocalDateStr(today);
    if (maxDateObj && todayStr > toLocalDateStr(maxDateObj)) return true;
    if (minDateObj && todayStr < toLocalDateStr(minDateObj)) return true;
    if (disabledDates?.includes(todayStr)) return true;
    return false;
  };
  const handleToday = () => {
    if (isTodayDisabled()) return;
    const today = new Date();
    onChange(toLocalDateStr(today));
    setSelectedDate(today);
    setIsOpen(false);
  };
  const handleClear = () => {
    onChange('');
    setSelectedDate(null);
    setIsOpen(false);
  };

  return (
    <div className="relative dropdown-container">
      {label && (
        <label className="block text-xs font-medium text-neutral-500 mb-1.5">{label}</label>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!isOpen) onOpen?.();
          const willOpen = !isOpen;
          if (willOpen && buttonRef.current) {
            // Determine available space below the button
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - buttonRect.bottom;
            const dropdownHeight = 400; // Approximate dropdown height
            setOpenDirection(spaceBelow < dropdownHeight && buttonRect.top > dropdownHeight ? 'up' : 'down');
          }
          setIsOpen(willOpen);
        }}
        className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 text-left flex items-center justify-between bg-white hover:border-success-300 transition-colors"
      >
        <span className={value ? 'text-neutral-900' : 'text-neutral-400'}>
          {value ? formatDate(selectedDate) : placeholder}
        </span>
        <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`fmd-animate-in absolute z-[9999] ${openDirection === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'} w-full max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-2xl p-4 ${
            popupPosition === 'left' ? 'right-0 left-auto' : 'left-0 right-auto'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              aria-label="Previous month"
              onClick={goToPreviousMonth}
              disabled={isMinMonth()}
              className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Select month"
                onClick={() => { setShowMonthSelector(!showMonthSelector); setShowYearSelector(false); }}
                className="font-semibold text-neutral-900 hover:text-primary-600 transition-colors"
              >
                {monthNames[currentMonth.getMonth()]}
              </button>
              <button
                type="button"
                aria-label="Select year"
                onClick={() => { setShowYearSelector(!showYearSelector); setShowMonthSelector(false); }}
                className="font-semibold text-neutral-900 hover:text-primary-600 transition-colors"
              >
                {currentMonth.getFullYear()}
              </button>
            </div>

            <button
              type="button"
              aria-label="Next month"
              onClick={goToNextMonth}
              disabled={isMaxMonth()}
              className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {showMonthSelector && (
            <div className="fmd-animate-in absolute top-16 left-0 right-0 bg-white border border-neutral-200 rounded-lg shadow-xl p-2 z-30 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-3 gap-1">
                {monthNames.map((month, index) => {
                  const year = currentMonth.getFullYear();
                  const firstDay = new Date(year, index, 1);
                  const lastDay = new Date(year, index + 1, 0);
                  const disabled = !!((minDateObj && lastDay < minDateObj) || (maxDateObj && firstDay > maxDateObj));
                  return (
                    <button
                      key={month}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleMonthChange(index)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        disabled ? 'text-neutral-300 cursor-not-allowed' :
                        currentMonth.getMonth() === index ? 'bg-primary-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {showYearSelector && (
            <div className="fmd-animate-in absolute top-16 left-0 right-0 bg-white border border-neutral-200 rounded-lg shadow-xl p-2 z-30 max-h-60 overflow-y-auto">
              <div className="grid grid-cols-4 gap-1">
                {years.map((year) => {
                  const disabled = !!((minDateObj && year < minDateObj.getFullYear()) || (maxDateObj && year > maxDateObj.getFullYear()));
                  return (
                    <button
                      key={year}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleYearChange(year)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        disabled ? 'text-neutral-300 cursor-not-allowed' :
                        currentMonth.getFullYear() === year ? 'bg-primary-600 text-white' : 'text-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-7 gap-1 mb-1 px-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-neutral-500 py-1 whitespace-nowrap">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 px-2">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="px-1 py-2" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const disabled = isDisabled(day);
              const selected = isSelected(day);
              const today = isToday(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => !disabled && handleDateClick(day)}
                  disabled={disabled}
                  className={`w-[40px] h-[40px] flex items-center justify-center px-1 py-2 text-sm rounded-lg transition-all duration-150
                    ${selected ? 'bg-primary-600 text-white font-medium' : disabled ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-700 hover:bg-neutral-100'}
                    ${today && !selected ? 'border-2 border-primary-600' : ''}
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {(showClear || showToday) && (
            <div className="flex gap-2 mt-4 pt-4 border-t border-neutral-200">
              {showClear && (
                <button type="button" onClick={handleClear} className="flex-1 px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
                  Clear
                </button>
              )}
              {showToday && (
                <button type="button" onClick={handleToday} disabled={isTodayDisabled()} className="flex-1 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  Today
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => {
            setIsOpen(false);
            setShowYearSelector(false);
            setShowMonthSelector(false);
            setOpenDirection('down');
          }}
        />
      )}
    </div>
  );
}
