'use client';

import { useEffect, useState } from 'react';
import { adminApi, User } from '@/lib/api/adminApi';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

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
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase());
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
        <div className="text-slate-600">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Management Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1b5eb8] shrink-0">
            <span className="material-symbols-outlined text-[26px]">manage_accounts</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">User Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">View and manage all user accounts across the platform</p>
          </div>
        </div>
      </div>

      {/* Summary Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL USERS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">group</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL USERS</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1b5eb8] border border-blue-100">
            <span className="material-symbols-outlined text-[14px]">verified</span> All Roles
          </span>
        </div>

        {/* Card 2: PATIENTS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-emerald-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">person</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">PATIENTS</div>
              <div className="text-2xl font-bold text-emerald-700 mt-0.5">{stats.patients}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Active
          </span>
        </div>

        {/* Card 3: DOCTORS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">stethoscope</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">DOCTORS</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.doctors}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1b5eb8] border border-blue-100">
            <span className="material-symbols-outlined text-[14px]">verified</span> Licensed
          </span>
        </div>

        {/* Card 4: SECRETARIES */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-purple-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">SECRETARIES</div>
              <div className="text-2xl font-bold text-purple-700 mt-0.5">{stats.secretaries}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
            <span className="material-symbols-outlined text-[14px]">verified</span> Staff
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search User input */}
        <div className="relative w-full lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8] transition-all"
            placeholder="Search by email address..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto">
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">Role:</span>
          <select
            className="h-9 px-3 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles</option>
            <option value="PATIENT">Patients</option>
            <option value="DOCTOR">Doctors</option>
            <option value="SECRETARY">Secretaries</option>
            <option value="ADMIN">Admins</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">User</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">User ID</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Created</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
                          {user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {user.email.split('@')[0]}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-700">{user.email}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'PATIENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        user.role === 'DOCTOR' ? 'bg-blue-50 text-[#1b5eb8] border border-blue-100' :
                        user.role === 'SECRETARY' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                        'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-mono text-slate-600">{user.id.slice(0, 8)}...</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
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
    </div>
  );
}