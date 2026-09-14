'use client';

import { useEffect, useState } from 'react';
import { adminApi, Doctor } from '@/lib/api/adminApi';

export default function DoctorManagement() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const response = await adminApi.getAllUsers();
      if (response.success && response.data) {
        const doctorUsers = response.data.filter(u => u.role === 'DOCTOR');
        // Note: This is a simplified approach. In production, we'd need a dedicated endpoint
        // that returns full doctor profiles with their practice information
        const doctorProfiles: Doctor[] = doctorUsers.map(user => ({
          id: user.id,
          userId: user.id,
          firstName: 'Doctor',
          lastName: 'Name',
          specialty: 'General Medicine',
          prcLicense: 'N/A',
          isApproved: true,
        }));
        setDoctors(doctorProfiles);
      }
    } catch (error) {
      console.error('Failed to load doctors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveDoctor = async (doctorId: string) => {
    try {
      const response = await adminApi.approveDoctor(doctorId);
      if (response.success) {
        loadDoctors();
      }
    } catch (error) {
      console.error('Failed to approve doctor:', error);
    }
  };

  const filteredDoctors = doctors.filter(doctor => {
    const matchesSearch = `${doctor.firstName} ${doctor.lastName} ${doctor.prcLicense} ${doctor.specialty}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesSpecialty = specialtyFilter === 'all' || doctor.specialty === specialtyFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'Active' && doctor.isApproved) ||
      (statusFilter === 'Inactive' && !doctor.isApproved);
    return matchesSearch && matchesSpecialty && matchesStatus;
  });

  const stats = {
    total: doctors.length,
    active: doctors.filter(d => d.isApproved).length,
    inactive: doctors.filter(d => !d.isApproved).length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading doctors...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Doctor Management Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1b5eb8] shrink-0">
            <span className="material-symbols-outlined text-[26px]">stethoscope</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Doctor Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">Oversee physician credentials, practice information, and account authorization</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors shadow-sm shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>+ Add Doctor</span>
          </button>
        </div>
      </div>

      {/* Summary Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: TOTAL PHYSICIANS */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">stethoscope</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">TOTAL PHYSICIANS</div>
              <div className="text-2xl font-bold text-slate-900 mt-0.5">{stats.total} Doctors</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-[#1b5eb8] border border-blue-100">
            <span className="material-symbols-outlined text-[14px]">verified</span> Licensed
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
            Scheduling Enabled
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
        {/* Search Doctor input */}
        <div className="relative w-full lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8] transition-all"
            placeholder="Search Doctor Name, PRC License, or Specialty..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Specialty Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Specialty:</span>
            <select
              className="h-9 px-3 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20"
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
            >
              <option value="all">All Specialties</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Internal Medicine">Internal Medicine</option>
              <option value="Neurology">Neurology</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Dermatology">Dermatology</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
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
      </div>

      {/* Doctors Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Doctor</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Specialty</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">PRC License</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Practice</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No doctors found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doctor) => (
                  <tr key={doctor.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm">
                          {doctor.firstName[0]}{doctor.lastName[0]}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {doctor.firstName} {doctor.lastName}
                          </div>
                          <div className="text-xs text-slate-500">ID: {doctor.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-700">{doctor.specialty}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-mono text-slate-600">{doctor.prcLicense}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-700">{doctor.practiceName || 'Not set'}</div>
                      {doctor.practiceAddress && (
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{doctor.practiceAddress}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {doctor.isApproved ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {!doctor.isApproved && (
                          <button
                            onClick={() => handleApproveDoctor(doctor.id)}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                          >
                            Approve
                          </button>
                        )}
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

      {/* Create Doctor Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Add New Doctor</h2>
              <p className="text-sm text-slate-500 mt-1">Create a new doctor account with practice information</p>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600">Doctor creation form would go here.</p>
              <p className="text-xs text-slate-400 mt-2">Note: This requires a dedicated backend endpoint for creating doctor profiles with practice information.</p>
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button className="px-4 py-2 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors">
                Create Doctor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}