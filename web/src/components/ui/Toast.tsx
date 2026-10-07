'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose?: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 2000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-sm font-semibold transition-all transform animate-in slide-in-from-right fade-in duration-300 flex items-center gap-3 ${
      type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
    }`}>
      <span>{message}</span>
      <button
        onClick={handleClose}
        className="hover:bg-white/20 rounded-full p-1 transition-colors"
        aria-label="Close"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}
