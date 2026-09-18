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
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const response = await adminApi.getAllDoctors();
      if (response.success && response.data) {
        // The backend now returns data in camelCase format that matches the Doctor interface
        // so we can use it directly without remapping
        setDoctors(response.data);
      }
    } catch (error) {
      console.error('Failed to load doctors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveDoctor = async (doctorId: string) => {
    if (!confirm('Are you sure you want to approve this doctor account? Once confirmed, the doctor will be authorized to sign in and access the Doctor Dashboard.')) {
      return;
    }
    
    try {
      const response = await adminApi.approveDoctor(doctorId);
      if (response.success) {
        loadDoctors();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Failed to approve doctor:', error);
    }
  };

  const handleViewDoctor = async (doctorId: string) => {
    try {
      const response = await adminApi.getDoctorById(doctorId);
      if (response.success && response.data) {
        setSelectedDoctor(response.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch doctor details:', error);
    }
  };

  const handleRejectDoctor = async (doctorId: string) => {
    const reason = prompt('Reason for rejection (optional):');
    
    if (!confirm('Are you sure you want to reject this doctor registration? The doctor will not be authorized to sign in.')) {
      return;
    }
    
    try {
      const response = await adminApi.rejectDoctor(doctorId, reason || '');
      if (response.success) {
        loadDoctors();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Failed to reject doctor:', error);
    }
  };

  const filteredDoctors = doctors.filter(doctor => {
    const matchesSearch = `${doctor.firstName || ''} ${doctor.lastName || ''} ${doctor.prcLicenseNumber || ''} ${doctor.specialty || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesSpecialty = specialtyFilter === 'all' || doctor.specialty === specialtyFilter;
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'Active' && doctor.approvalStatus === 'ACTIVE') ||
      (statusFilter === 'Pending' && doctor.approvalStatus === 'PENDING') ||
      (statusFilter === 'Rejected' && doctor.approvalStatus === 'REJECTED');
    return matchesSearch && matchesSpecialty && matchesStatus;
  });

  const stats = {
    total: doctors.length,
    active: doctors.filter(d => d.approvalStatus === 'ACTIVE').length,
    pending: doctors.filter(d => d.approvalStatus === 'PENDING').length,
    rejected: doctors.filter(d => d.approvalStatus === 'REJECTED').length,
  };

  // Get unique specialties for filter dropdown
  const specialties = Array.from(new Set(doctors.map(d => d.specialty).filter(Boolean))).sort();

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Card 3: PENDING APPROVAL */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-amber-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">schedule</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">PENDING APPROVAL</div>
              <div className="text-2xl font-bold text-amber-700 mt-0.5">{stats.pending} Pending</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            <span className="material-symbols-outlined text-[14px]">pending</span> Awaiting Review
          </span>
        </div>

        {/* Card 4: REJECTED */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:border-red-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">cancel</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">REJECTED</div>
              <div className="text-2xl font-bold text-red-700 mt-0.5">{stats.rejected} Rejected</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
            <span className="material-symbols-outlined text-[14px]">block</span> Not Approved
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
              {specialties.map(specialty => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
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
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
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
                          {(doctor.firstName || 'D')[0]}{(doctor.lastName || '')[0]}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {doctor.firstName || 'Unknown'} {doctor.lastName || 'Doctor'}
                          </div>
                          <div className="text-xs text-slate-500">ID: {doctor.id?.slice(0, 8) || 'N/A'}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-700">{doctor.specialty}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-mono text-slate-600">{doctor.prcLicenseNumber || 'N/A'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-700">{doctor.practiceName || 'Not set'}</div>
                      {doctor.practiceAddress && (
                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{doctor.practiceAddress}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {doctor.approvalStatus === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      ) : doctor.approvalStatus === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          Rejected
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleViewDoctor(doctor.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
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

      {/* Doctor Detail Modal */}
      {showDetailModal && selectedDoctor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Doctor Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500">Name</label>
                <p className="text-sm text-slate-900">{selectedDoctor.firstName} {selectedDoctor.lastName}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Email</label>
                <p className="text-sm text-slate-900">{selectedDoctor.email}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Email Verified</label>
                <p className="text-sm text-slate-900">{selectedDoctor.emailVerified ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Specialty</label>
                <p className="text-sm text-slate-900">{selectedDoctor.specialty}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Credentials</label>
                <p className="text-sm text-slate-900">{selectedDoctor.credentials || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">PRC License Number</label>
                <p className="text-sm text-slate-900">{selectedDoctor.prcLicenseNumber}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Practice Name</label>
                <p className="text-sm text-slate-900">{selectedDoctor.practiceName || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Practice Address</label>
                <p className="text-sm text-slate-900">{selectedDoctor.practiceAddress || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Practice Phone</label>
                <p className="text-sm text-slate-900">{selectedDoctor.practicePhone || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Status</label>
                <p className="text-sm text-slate-900">{selectedDoctor.approvalStatus}</p>
              </div>
              {selectedDoctor.rejectionReason && (
                <div>
                  <label className="text-xs font-semibold text-slate-500">Rejection Reason</label>
                  <p className="text-sm text-slate-900">{selectedDoctor.rejectionReason}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-between gap-3">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
              {selectedDoctor.approvalStatus === 'PENDING' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejectDoctor(selectedDoctor.id)}
                    className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveDoctor(selectedDoctor.id)}
                    className="px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    Confirm Doctor
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}