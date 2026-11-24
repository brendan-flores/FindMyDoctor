'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePresence } from '@/hooks/usePresence';

interface TimePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (time: string) => void;
  initialTime?: string; // HH:MM format (24-hour)
}

export default function TimePicker({
  isOpen,
  onClose,
  onConfirm,
  initialTime,
}: TimePickerProps) {
  const modalPresent = usePresence(isOpen);
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

  // Parse initial 24-hour time into 12-hour components
  useEffect(() => {
    if (!isOpen || !initialTime) return;
    const [h, m] = initialTime.split(':').map(Number);
    const displayHour = h % 12 || 12;
    setHour(displayHour.toString());
    setMinute(m.toString().padStart(2, '0'));
    setPeriod(h >= 12 ? 'PM' : 'AM');
  }, [initialTime, isOpen]);

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 12) val = '12';
    setHour(val);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 2) val = val.slice(0, 2);
    setMinute(val);
  };

  const handleConfirm = useCallback(() => {
    const h = parseInt(hour || '0', 10) || 12;
    const m = parseInt(minute || '0', 10) || 0;
    const hour24 = period === 'PM' && h !== 12 ? h + 12 : period === 'AM' && h === 12 ? 0 : h;
    const time24 = `${hour24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    onConfirm(time24);
  }, [hour, minute, period, onConfirm]);

  if (!modalPresent) return null;

  return (
    <div
      className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      data-state={isOpen ? 'open' : 'closed'}
      onClick={onClose}
    >
      <div
        className="fmd-modal-panel bg-white rounded-3xl shadow-lg border border-neutral-200 p-8 max-w-sm w-full"
        data-state={isOpen ? 'open' : 'closed'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-8">
            Enter Time
          </h3>

          <div className="flex items-center justify-center gap-4 mb-10">
            {/* Hour */}
            <div className="flex flex-col items-center">
              <input
                type="text"
                maxLength={2}
                value={hour}
                onChange={handleHourChange}
                placeholder="--"
                className="w-20 h-16 text-center text-3xl font-medium text-neutral-900 border-2 border-neutral-300 rounded-xl focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 focus:outline-none transition-all"
              />
              <span className="mt-2 text-xs font-medium text-neutral-500 uppercase">Hour</span>
            </div>

            <span className="text-3xl font-medium text-neutral-400">:</span>

            {/* Minute */}
            <div className="flex flex-col items-center">
              <input
                type="text"
                maxLength={2}
                value={minute}
                onChange={handleMinuteChange}
                placeholder="00"
                className="w-20 h-16 text-center text-3xl font-medium text-neutral-900 border-2 border-neutral-300 rounded-xl focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 focus:outline-none transition-all"
              />
              <span className="mt-2 text-xs font-medium text-neutral-500 uppercase">Minute</span>
            </div>

            {/* AM/PM */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setPeriod('AM')}
                className={`w-16 h-12 text-center text-sm font-semibold rounded-xl transition-colors ${
                  period === 'AM'
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setPeriod('PM')}
                className={`w-16 h-12 text-center text-sm font-semibold rounded-xl transition-colors ${
                  period === 'PM'
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                PM
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-neutral-600 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-6 py-2.5 text-sm font-semibold text-white rounded-xl bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600/20 transition-colors"
              disabled={!hour || !minute}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
