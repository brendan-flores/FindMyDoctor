'use client';

import { useEffect, useState } from 'react';
import { adminApi, Secretary } from '@/lib/api/adminApi';

export default function SecretaryManagement() {
  const [secretaries, setSecretaries] = useState<Secretary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedSecretary, setSelectedSecretary] = useState<Secretary | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  useEffect(() => {
    loadSecretaries();
  }, []);

  const loadSecretaries = async () => {
    try {
      const response = await adminApi.getAllSecretaries();
      if (response.success && response.data) {
        setSecretaries(response.data);
      }
    } catch (error) {
      console.error('Failed to load secretaries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveSecretary = async (secretaryId: string) => {
    try {
      const response = await adminApi.approveSecretary(secretaryId);
      if (response.success) {
        loadSecretaries();
      }
    } catch (error) {
      console.error('Failed to approve secretary:', error);
    }
  };

  const filteredSecretaries = secretaries.filter(secretary => {
    const matchesSearch = `${secretary.firstName} ${secretary.lastName} ${secretary.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'Active' && secretary.isActive) ||
      (statusFilter === 'Inactive' && !secretary.isActive);
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: secretaries.length,
    active: secretaries.filter(s => s.isActive).length,
    inactive: secretaries.filter(s => !s.isActive).length,
    unassigned: secretaries.filter(s => !s.doctorId).length,
  };

  const handleDeactivateSecretary = (secretary: Secretary) => {
    setSelectedSecretary(secretary);
    setShowDeactivateModal(true);
  };

  const confirmDeactivateSecretary = async () => {
    if (!selectedSecretary) return;

    try {
      const response = await adminApi.deactivateSecretary(selectedSecretary.id);
      if (response.success) {
        loadSecretaries();
        setShowDeactivateModal(false);
        setSelectedSecretary(null);
      }
    } catch (error) {
      console.error('Failed to deactivate secretary:', error);
    }
  };

  const handleReactivateSecretary = async (secretaryId: string) => {
    try {
      const response = await adminApi.reactivateSecretary(secretaryId);
      if (response.success) {
        loadSecretaries();
      }
    } catch (error) {
      console.error('Failed to reactivate secretary:', error);
    }
  };

  const handleResetPassword = async (secretary: Secretary) => {
    setSelectedSecretary(secretary);
    try {
      const response = await adminApi.resetSecretaryPassword(secretary.id);
      if (response.success && response.data) {
        setPasswordResult(response.data);
        setShowPasswordModal(true);
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading secretaries...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: TOTAL SECRETARIES */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL SECRETARIES</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total} Secretaries</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1b5eb8] border border-blue-100">
            <span className="material-symbols-outlined text-[14px]">verified</span> Registered
          </span>
        </div>

        {/* Card 2: ACTIVE STATUS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">check_circle</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">ACTIVE STATUS</div>
              <div className="text-2xl font-bold text-emerald-700 mt-0.5">{stats.active} Active</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            On Duty
          </span>
        </div>

        {/* Card 3: INACTIVE / SUSPENDED */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-amber-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">pause_circle</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">INACTIVE / SUSPENDED</div>
              <div className="text-2xl font-bold text-amber-700 mt-0.5">{stats.inactive} Inactive</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <span className="material-symbols-outlined text-[14px]">warning</span> Action Required
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search Secretary input */}
        <div className="relative w-full lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8] transition-all"
            placeholder="Search Secretary Name..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Status:</span>
          <select
            className="h-9 px-3 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Secretaries Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Secretary</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Associated Doctor</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSecretaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No secretaries found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSecretaries.map((secretary) => (
                  <tr key={secretary.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
                          {(secretary.firstName || 'S')[0]}{(secretary.lastName || '')[0]}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {secretary.firstName || 'N/A'} {secretary.lastName || 'N/A'}
                          </div>
                          <div className="text-xs text-slate-500">ID: {secretary.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-700">{secretary.email}</span>
                    </td>
                    <td className="px-5 py-4">
                      {secretary.doctorId ? (
                        <div>
                          <div className="text-sm text-slate-700">
                            Dr. {secretary.doctorFirstName} {secretary.doctorLastName}
                          </div>
                          <div className="text-xs text-slate-500">{secretary.doctorSpecialty}</div>
                        </div>
                      ) : (
                        <span className="text-sm text-amber-600 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {secretary.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {secretary.isActive ? (
                          <button
                            onClick={() => handleDeactivateSecretary(secretary)}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateSecretary(secretary.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => handleResetPassword(secretary)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          Reset Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Secretary Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Add New Secretary</h2>
              <p className="text-sm text-slate-500 mt-1">Create a new secretary account and associate with a doctor</p>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">Secretary creation form would go here.</p>
              <p className="text-xs text-slate-400 mt-2">Note: This requires selecting a doctor to associate the secretary with.</p>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors">
                Create Secretary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {showDeactivateModal && selectedSecretary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Deactivate Secretary Account</h2>
              <p className="text-sm text-slate-500 mt-1">Are you sure you want to deactivate this secretary?</p>
            </div>
            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 font-medium mb-2">This action will:</p>
                <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                  <li>Prevent the Secretary from logging in</li>
                  <li>Invalidate all existing sessions and tokens</li>
                  <li>Remove all registered push device tokens</li>
                  <li>NOT delete any appointments, queue entries, or records</li>
                </ul>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setSelectedSecretary(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivateSecretary}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Result Modal */}
      {showPasswordModal && passwordResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Temporary Credentials Generated</h2>
              <p className="text-sm text-slate-500 mt-1">New password for the secretary account</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</label>
                <p className="text-sm font-medium text-slate-900 mt-1">{passwordResult.email}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Temporary Password</label>
                <div className="mt-1 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-lg font-mono font-bold text-slate-900">{passwordResult.temporaryPassword}</p>
                </div>
                <p className="text-xs text-slate-500 mt-2">The secretary must change this password on first login.</p>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordResult(null);
                  setSelectedSecretary(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}