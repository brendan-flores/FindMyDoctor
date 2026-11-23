'use client';

import { useEffect, useState } from 'react';
import { adminApi, User } from '@/lib/api/adminApi';
import Select from '@/components/ui/Select';
import { usePresenceValue } from '@/hooks/usePresence';

function userDisplayName(user: User): string {
  const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return fullName.length > 0 ? fullName : user.email.split('@')[0];
}

function userInitials(user: User): string {
  const name = userDisplayName(user);
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { present: detailsPresent, value: detailsUser } = usePresenceValue(selectedUser);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await adminApi.getAllUsers();
      if (response.success && response.data) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      user.email.toLowerCase().includes(term) ||
      userDisplayName(user).toLowerCase().includes(term);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    patients: users.filter(u => u.role === 'PATIENT').length,
    doctors: users.filter(u => u.role === 'DOCTOR').length,
    secretaries: users.filter(u => u.role === 'SECRETARY').length,
    admins: users.filter(u => u.role === 'ADMIN').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-neutral-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL USERS */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-primary-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">group</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">TOTAL USERS</div>
              <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.total}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 border border-primary-100">
            <span className="material-symbols-outlined text-[14px]">verified</span> All Roles
          </span>
        </div>

        {/* Card 2: PATIENTS */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-success-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-success-50 text-success-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">person</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">PATIENTS</div>
              <div className="text-2xl font-bold text-success-700 mt-0.5">{stats.patients}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-success-50 text-success-700 border border-success-200">
            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
            Active
          </span>
        </div>

        {/* Card 3: DOCTORS */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-primary-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">stethoscope</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">DOCTORS</div>
              <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.doctors}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 border border-primary-100">
            <span className="material-symbols-outlined text-[14px]">verified</span> Licensed
          </span>
        </div>

        {/* Card 4: SECRETARIES */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-primary-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">SECRETARIES</div>
              <div className="text-2xl font-bold text-primary-700 mt-0.5">{stats.secretaries}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
            <span className="material-symbols-outlined text-[14px]">verified</span> Staff
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-md flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search User input */}
        <div className="relative w-full lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
            placeholder="Search by email address..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto">
          <span className="text-xs text-neutral-400 font-medium hidden sm:inline">Role:</span>
          <Select
            className="w-36"
            triggerClassName="h-9 px-3 text-xs"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'PATIENT', label: 'Patients' },
              { value: 'DOCTOR', label: 'Doctors' },
              { value: 'SECRETARY', label: 'Secretaries' },
              { value: 'ADMIN', label: 'Admins' },
            ]}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/50">
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">User</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Email</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Role</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Created</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-neutral-500 text-sm">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-semibold text-sm">
                          {userInitials(user)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-neutral-900">
                            {userDisplayName(user)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-neutral-700 break-all">{user.email}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'PATIENT' ? 'bg-success-50 text-success-700 border border-success-200' :
                        user.role === 'DOCTOR' ? 'bg-primary-50 text-primary-600 border border-primary-100' :
                        user.role === 'SECRETARY' ? 'bg-primary-50 text-primary-700 border border-primary-200' :
                        'bg-neutral-50 text-neutral-700 border border-neutral-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-neutral-600">
                        {formatDate(user.createdAt)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
                        >
                          View
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

      {/* User Details Modal */}
      {detailsPresent && detailsUser && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={selectedUser ? 'open' : 'closed'}
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-md w-full shadow-xl"
            data-state={selectedUser ? 'open' : 'closed'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-neutral-200 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-semibold">
                  {userInitials(detailsUser)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">{userDisplayName(detailsUser)}</h2>
                  <p className="text-sm text-neutral-500 break-all">{detailsUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Role</label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      detailsUser.role === 'PATIENT' ? 'bg-success-50 text-success-700 border border-success-200' :
                      detailsUser.role === 'DOCTOR' ? 'bg-primary-50 text-primary-600 border border-primary-100' :
                      detailsUser.role === 'SECRETARY' ? 'bg-primary-50 text-primary-700 border border-primary-200' :
                      'bg-neutral-50 text-neutral-700 border border-neutral-200'
                    }`}>
                      {detailsUser.role}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Account Status</label>
                  <div className="mt-1">
                    {detailsUser.isActive === false ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-error-50 text-error-700 border border-error-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-error-500"></span>
                        Inactive
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-500"></span>
                        Active
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Password Change Required</label>
                  <p className="text-sm font-medium text-neutral-900 mt-1">
                    {detailsUser.mustChangePassword ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Registered</label>
                  <p className="text-sm font-medium text-neutral-900 mt-1">{formatDate(detailsUser.createdAt)}</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">User ID</label>
                <div className="mt-1 p-3 bg-neutral-50 border border-neutral-200 rounded-lg">
                  <p className="text-sm font-mono text-neutral-900 break-all">{detailsUser.id}</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => setSelectedUser(null)}
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