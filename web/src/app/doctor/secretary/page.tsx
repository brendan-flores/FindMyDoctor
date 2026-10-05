'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/apiClient';

export default function DoctorSecretary() {
  const [secretaries, setSecretaries] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [secretaryForm, setSecretaryForm] = useState({
    email: '',
    password: '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSecretaries();
  }, []);

  const loadSecretaries = async () => {
    try {
      const response = await apiClient.get('/doctors/secretaries');
      if (response.success && response.data) {
        setSecretaries(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err) {
      console.error('Failed to load secretaries');
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
        loadSecretaries();
        setTimeout(() => {
          setShowAddModal(false);
          setSuccess('');
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1b5eb8] shrink-0">
            <span className="material-symbols-outlined text-[26px]">badge</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Secretary Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage your secretaries and their access</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Secretary
        </button>
      </div>

      {/* Secretaries List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Your Secretaries</h3>
        </div>
        {secretaries.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <span className="material-symbols-outlined text-[48px] text-slate-300 mb-2">badge</span>
            <p className="text-sm">No secretaries added yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {secretaries.map((secretary) => (
              <div key={secretary.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{secretary.email}</div>
                    <div className="text-xs text-slate-500">Secretary</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-600 font-medium">Active</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Secretary Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Add Secretary</h2>
              <p className="text-sm text-slate-500 mt-1">Create a secretary account for your practice</p>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={secretaryForm.email}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8] text-slate-900"
                  placeholder="secretary@example.com"
                  disabled={isCreating}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                <input
                  type="password"
                  value={secretaryForm.password}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8] text-slate-900"
                  placeholder="Enter temporary password"
                  disabled={isCreating}
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSecretaryForm({ email: '', password: '' });
                  setError('');
                  setSuccess('');
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSecretary}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
