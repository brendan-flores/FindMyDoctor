'use client';

import { useEffect, useState } from 'react';
import { adminApi, Doctor, DoctorSchedule } from '@/lib/api/adminApi';

export default function DoctorManagement() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

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
        setDoctorSchedules([]);
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

        // Load doctor schedules
        setIsLoadingSchedules(true);
        try {
          const schedulesResponse = await adminApi.getDoctorSchedules(doctorId);
          if (schedulesResponse.success && schedulesResponse.data) {
            setDoctorSchedules(schedulesResponse.data);
          }
        } catch (scheduleError) {
          console.error('Failed to fetch doctor schedules:', scheduleError);
        } finally {
          setIsLoadingSchedules(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch doctor details:', error);
    }
  };

  const handleRejectDoctor = () => {
    setShowRejectModal(true);
  };

  const confirmRejectDoctor = async () => {
    if (!rejectionReason || rejectionReason.trim() === '') {
      alert('Rejection reason is required. Please provide a reason for rejecting this doctor.');
      return;
    }

    if (!selectedDoctor) return;

    try {
      const response = await adminApi.rejectDoctor(selectedDoctor.id, rejectionReason);
      if (response.success) {
        loadDoctors();
        setShowDetailModal(false);
        setShowRejectModal(false);
        setRejectionReason('');
        setDoctorSchedules([]);
      }
    } catch (error) {
      console.error('Failed to reject doctor:', error);
    }
  };

  const cancelRejectDoctor = () => {
    setShowRejectModal(false);
    setRejectionReason('');
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

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
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
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Doctor Review</h2>
                  <p className="text-sm text-slate-500 mt-1">Review and approve doctor application</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setDoctorSchedules([]);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">

              {/* Basic Information Section */}
              <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-5 border border-blue-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-blue-600">person</span>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">First Name</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.firstName || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Middle Name</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.middleName || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Name</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.lastName || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email Address</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.email || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email Verified</label>
                    <p className="text-sm font-medium mt-1">
                      {selectedDoctor.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Yes
                        </span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Number</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.contactNumber || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Professional Information Section */}
              <div className="bg-gradient-to-br from-emerald-50 to-slate-50 rounded-xl p-5 border border-emerald-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-emerald-600">medical_services</span>
                  Professional Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Professional Photo</label>
                      {selectedDoctor.professionalPhotoUrl ? (
                        <button
                          onClick={() => setShowPhotoModal(true)}
                          className="cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={selectedDoctor.professionalPhotoUrl}
                            alt="Professional Photo"
                            className="w-28 h-28 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                            onError={(e) => {
                              console.error('Image failed to load:', e.currentTarget.src);
                              console.error('Professional photo URL:', selectedDoctor.professionalPhotoUrl);
                            }}
                          />
                        </button>
                      ) : (
                        <div className="w-28 h-28 rounded-full border-2 border-dashed border-slate-300 bg-slate-100 flex items-center justify-center">
                          <span className="text-xs text-slate-400">No photo</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Specialty</label>
                        <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.specialty || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Credentials</label>
                        <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.credentials || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PRC License Number</label>
                        <p className="text-sm font-mono font-medium text-slate-900 mt-1">{selectedDoctor.prcLicenseNumber || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hospital/Clinic</label>
                        <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.practiceName || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Years of Experience</label>
                        <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.yearsOfExperience || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Consultation Fee</label>
                        <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.consultationFee ? `₱${selectedDoctor.consultationFee}` : 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-slate-200">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Languages Spoken</label>
                        <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.languagesSpoken || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Areas of Expertise</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.areasOfExpertise || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Short Biography</label>
                    <p className="text-sm font-medium text-slate-900 mt-1 leading-relaxed">{selectedDoctor.biography || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Available Schedule Section */}
              <div className="bg-gradient-to-br from-amber-50 to-slate-50 rounded-xl p-5 border border-amber-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-amber-600">schedule</span>
                  Available Schedule
                </h3>
                {isLoadingSchedules ? (
                  <p className="text-sm text-slate-500">Loading schedules...</p>
                ) : doctorSchedules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {doctorSchedules.map((schedule) => (
                      <div key={schedule.id} className="bg-white rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-slate-900">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][schedule.dayOfWeek]}</span>
                        </div>
                        <div className="text-sm text-slate-600 font-medium">
                          {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic">No schedules configured</p>
                )}
              </div>

              {/* Status Section */}
              <div className="bg-gradient-to-br from-purple-50 to-slate-50 rounded-xl p-5 border border-purple-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-purple-600">info</span>
                  Account Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Approval Status</label>
                    <p className="text-sm font-medium mt-1">
                      {selectedDoctor.approvalStatus === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Active
                        </span>
                      ) : selectedDoctor.approvalStatus === 'PENDING' ? (
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
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Profile Completion Status</label>
                    <p className="text-sm font-medium text-slate-900 mt-1">{selectedDoctor.profileCompletionStatus || 'N/A'}</p>
                  </div>
                  {selectedDoctor.rejectionReason && (
                    <div className="bg-white rounded-lg p-3 border border-slate-200 md:col-span-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Rejection Reason</label>
                      <p className="text-sm font-medium text-red-700 mt-1">{selectedDoctor.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDoctorSchedules([]);
                }}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors shadow-sm"
              >
                Close
              </button>
              {selectedDoctor.approvalStatus === 'PENDING' && (
                <div className="flex gap-3">
                  <button
                    onClick={handleRejectDoctor}
                    className="px-5 py-2.5 text-sm font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-300 rounded-lg transition-colors shadow-sm"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveDoctor(selectedDoctor.id)}
                    className="px-5 py-2.5 text-sm font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg transition-colors shadow-sm"
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Reject Doctor Application</h2>
              <p className="text-sm text-slate-500 mt-1">Please provide a reason for rejection</p>
            </div>
            <div className="p-6">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                rows={4}
                className="block w-full rounded-xl border border-slate-300 bg-white py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all resize-none"
              />
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={cancelRejectDoctor}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectDoctor}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Reject Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedDoctor?.professionalPhotoUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowPhotoModal(false)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedDoctor.professionalPhotoUrl}
              alt="Professional Photo"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                console.error('Modal image failed to load:', e.currentTarget.src);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}