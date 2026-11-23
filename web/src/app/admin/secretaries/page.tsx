'use client';

import { useEffect, useState } from 'react';
import { adminApi, Secretary } from '@/lib/api/adminApi';
import Select from '@/components/ui/Select';
import { usePresence } from '@/hooks/usePresence';

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

  const deactivateModalOpen = showDeactivateModal && !!selectedSecretary;
  const passwordModalOpen = showPasswordModal && !!passwordResult;
  const createModalPresent = usePresence(showCreateModal);
  const deactivateModalPresent = usePresence(deactivateModalOpen);
  const passwordModalPresent = usePresence(passwordModalOpen);

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
        <div className="text-neutral-600">Loading secretaries...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: TOTAL SECRETARIES */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-primary-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">TOTAL SECRETARIES</div>
              <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.total} Secretaries</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 border border-primary-100">
            <span className="material-symbols-outlined text-[14px]">verified</span> Registered
          </span>
        </div>

        {/* Card 2: ACTIVE STATUS */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-success-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-success-50 text-success-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">check_circle</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">ACTIVE STATUS</div>
              <div className="text-2xl font-bold text-success-700 mt-0.5">{stats.active} Active</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-success-50 text-success-700 border border-success-200">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
            On Duty
          </span>
        </div>

        {/* Card 3: INACTIVE / SUSPENDED */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-warning-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-warning-50 text-warning-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">pause_circle</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">INACTIVE / SUSPENDED</div>
              <div className="text-2xl font-bold text-warning-700 mt-0.5">{stats.inactive} Inactive</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-warning-50 text-warning-700 border border-warning-200">
            <span className="material-symbols-outlined text-[14px]">warning</span> Action Required
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-md flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search Secretary input */}
        <div className="relative w-full lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
            placeholder="Search Secretary Name..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto">
          <span className="text-xs text-neutral-400 font-medium hidden sm:inline">Status:</span>
          <Select
            className="w-36"
            triggerClassName="h-9 px-3 text-xs"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      {/* Secretaries Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[20%]" />
              <col className="w-[24%]" />
              <col className="w-[12%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Secretary</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Email</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Associated Doctor</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSecretaries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    No secretaries found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredSecretaries.map((secretary) => (
                  <tr key={secretary.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-semibold text-sm flex-shrink-0">
                          {(secretary.firstName || 'S')[0]}{(secretary.lastName || '')[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 whitespace-nowrap">
                            {secretary.firstName || 'N/A'} {secretary.lastName || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="block text-sm text-neutral-700 truncate" title={secretary.email}>
                        {secretary.email}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {secretary.doctorId ? (
                        <div className="min-w-0">
                          <div className="text-sm text-neutral-700 truncate" title={`Dr. ${secretary.doctorFirstName} ${secretary.doctorLastName}`}>
                            Dr. {secretary.doctorFirstName} {secretary.doctorLastName}
                          </div>
                          <div className="text-xs text-neutral-500 truncate" title={secretary.doctorSpecialty}>
                            {secretary.doctorSpecialty}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-warning-600 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {secretary.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 h-7 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-200 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-success-500"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 h-7 rounded-full text-xs font-semibold bg-error-50 text-error-700 border border-error-200 whitespace-nowrap">
                          <span className="material-symbols-outlined text-[14px]">block</span>
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {secretary.isActive ? (
                          <button
                            onClick={() => handleDeactivateSecretary(secretary)}
                            className="px-3 h-8 text-xs font-semibold text-error-700 bg-error-50 hover:bg-error-100 border border-error-200 rounded-lg transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivateSecretary(secretary.id)}
                            className="px-3 h-8 text-xs font-semibold text-success-700 bg-success-50 hover:bg-success-100 border border-success-200 rounded-lg transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => handleResetPassword(secretary)}
                          className="px-3 h-8 text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
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
      {createModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={showCreateModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            data-state={showCreateModal ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900">Add New Secretary</h2>
              <p className="text-sm text-neutral-500 mt-1">Create a new secretary account and associate with a doctor</p>
            </div>
            <div className="p-6">
              <p className="text-sm text-neutral-600">Secretary creation form would go here.</p>
              <p className="text-xs text-neutral-400 mt-2">Note: This requires selecting a doctor to associate the secretary with.</p>
            </div>
            <div className="p-6 border-t border-neutral-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
                Create Secretary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={deactivateModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-md w-full shadow-xl"
            data-state={deactivateModalOpen ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900">Deactivate Secretary Account</h2>
              <p className="text-sm text-neutral-500 mt-1">Are you sure you want to deactivate this secretary?</p>
            </div>
            <div className="p-6">
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                <p className="text-sm text-warning-800 font-medium mb-2">This action will:</p>
                <ul className="text-sm text-warning-700 list-disc list-inside space-y-1">
                  <li>Prevent the Secretary from logging in</li>
                  <li>Invalidate all existing sessions and tokens</li>
                  <li>Remove all registered push device tokens</li>
                  <li>NOT delete any appointments, queue entries, or records</li>
                </ul>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivateSecretary}
                className="px-4 py-2 text-sm font-semibold text-white bg-error-600 hover:bg-error-700 rounded-lg transition-colors"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Result Modal */}
      {passwordModalPresent && passwordResult && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={passwordModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-md w-full shadow-xl"
            data-state={passwordModalOpen ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900">Temporary Credentials Generated</h2>
              <p className="text-sm text-neutral-500 mt-1">New password for the secretary account</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Email</label>
                <p className="text-sm font-medium text-neutral-900 mt-1">{passwordResult.email}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Temporary Password</label>
                <div className="mt-1 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <p className="text-lg font-mono font-bold text-neutral-900">{passwordResult.temporaryPassword}</p>
                </div>
                <p className="text-xs text-neutral-500 mt-2">The secretary must change this password on first login.</p>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                }}
                className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors"
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