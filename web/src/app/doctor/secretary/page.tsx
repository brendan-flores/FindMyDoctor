'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';
import { usePresence } from '@/hooks/usePresence';

interface SecretarySummary {
  id: string;
  doctor_id: string;
  email: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  contact_number: string | null;
  is_approved: boolean;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export default function DoctorSecretary() {
  const [secretaries, setSecretaries] = useState<SecretarySummary[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const addModalPresent = usePresence(showAddModal);
  const [secretaryForm, setSecretaryForm] = useState({
    email: '',
    password: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSecretaries();
  }, []);

  const loadSecretaries = async () => {
    try {
      const response = await apiClient.get('/doctors/secretaries');
      if (!response.success || !Array.isArray(response.data)) {
        setListError(response.error || 'Failed to load secretaries');
        return;
      }

      setSecretaries(response.data as SecretarySummary[]);
      setListError('');
    } catch (err) {
      console.error('Failed to load secretaries:', err);
      setListError('Failed to load secretaries');
    }
  };

  const handleAddSecretary = async () => {
    if (!secretaryForm.email || !secretaryForm.password) {
      setError('Email and password are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(secretaryForm.email)) {
      setError('Invalid email format');
      return;
    }

    setIsCreating(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.post('/doctors/secretaries', {
        email: secretaryForm.email,
        password: secretaryForm.password,
      });

      if (response.success) {
        setSuccess('Secretary created successfully');
        setSecretaryForm({ email: '', password: '' });
        await loadSecretaries();
        setTimeout(() => {
          setShowAddModal(false);
        }, 2000);
      } else {
        setError(response.error || 'Failed to create secretary');
      }
    } catch (err) {
      setError('Failed to create secretary');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Secretaries List */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
        <div className="p-6 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white flex items-center justify-between">
          <h3 className="text-xl font-bold text-neutral-800">Your Secretaries</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-10 px-4 rounded-xl bg-white hover:bg-primary-50 text-primary-600 font-semibold text-sm flex items-center gap-2 shadow-md transition-all transform hover:scale-105 border border-primary-200"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Add Secretary</span>
          </button>
        </div>
        {listError ? (
          <div className="p-8 text-center text-error-700">
            <p className="text-sm">{listError}</p>
          </div>
        ) : secretaries.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            <span className="material-symbols-outlined text-[48px] text-neutral-300 mb-2">badge</span>
            <p className="text-sm">No secretaries added yet</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {secretaries.map((secretary) => (
              <div key={secretary.id} className="p-5 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-[22px]">person</span>
                  </div>
                  <div>
                    <div className="text-base font-semibold text-neutral-800">
                      {[secretary.first_name, secretary.middle_name, secretary.last_name].filter(Boolean).join(' ') || secretary.email}
                    </div>
                    <div className="text-sm text-neutral-500">{secretary.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
                    secretary.is_active
                      ? 'bg-gradient-to-r from-success-500 to-success-600 text-white shadow-md'
                      : 'bg-neutral-200 text-neutral-500'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${secretary.is_active ? 'bg-white' : 'bg-neutral-400'}`}></span>
                    {secretary.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Secretary Modal */}
      {addModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={showAddModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={showAddModal ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-6">Add Secretary</h3>
            <div className="space-y-4">
              {error && (
                <Toast message={error} type="error" onClose={() => setError('')} />
              )}
              {success && (
                <Toast message={success} type="success" onClose={() => setSuccess('')} />
              )}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Email</label>
                <input
                  type="email"
                  value={secretaryForm.email}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-700 bg-white hover:border-primary-300 transition-all"
                  placeholder="secretary@example.com"
                  disabled={isCreating}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Temporary Password</label>
                <input
                  type="password"
                  value={secretaryForm.password}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-700 bg-white hover:border-primary-300 transition-all"
                  placeholder="Enter temporary password"
                  disabled={isCreating}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSecretaryForm({ email: '', password: '' });
                  setError('');
                  setSuccess('');
                }}
                className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSecretary}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Secretary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
