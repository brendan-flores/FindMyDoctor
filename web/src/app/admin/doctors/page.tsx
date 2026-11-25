'use client';

import { useEffect, useState } from 'react';
import { adminApi, Doctor, DoctorSchedule } from '@/lib/api/adminApi';
import Select from '@/components/ui/Select';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { usePresence } from '@/hooks/usePresence';

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
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);

  const detailModalOpen = showDetailModal && !!selectedDoctor;
  const deactivateModalOpen = showDeactivateModal && !!selectedDoctor;
  const photoModalOpen = showPhotoModal && !!selectedDoctor?.professionalPhotoUrl;
  const detailModalPresent = usePresence(detailModalOpen);
  const rejectModalPresent = usePresence(showRejectModal);
  const deactivateModalPresent = usePresence(deactivateModalOpen);
  const photoModalPresent = usePresence(photoModalOpen);

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

  const handleApproveDoctor = async () => {
    if (!selectedDoctor) return;

    setIsApproving(true);
    try {
      const response = await adminApi.approveDoctor(selectedDoctor.id);
      if (response.success) {
        loadDoctors();
        setShowDetailModal(false);
        setDoctorSchedules([]);
      }
    } catch (error) {
      console.error('Failed to approve doctor:', error);
    } finally {
      setIsApproving(false);
      setShowApproveConfirm(false);
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
      setInfoDialog({
        title: 'Rejection reason required',
        message: 'Please provide a reason for rejecting this doctor.',
      });
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

  const handleDeactivateDoctor = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setShowDeactivateModal(true);
  };

  const confirmDeactivateDoctor = async () => {
    if (!selectedDoctor) return;

    try {
      const response = await adminApi.deactivateDoctor(selectedDoctor.id);
      if (response.success) {
        loadDoctors();
        setShowDetailModal(false);
        setShowDeactivateModal(false);
        setDoctorSchedules([]);
      }
    } catch (error) {
      console.error('Failed to deactivate doctor:', error);
    }
  };

  const handleReactivateDoctor = async (doctorId: string) => {
    try {
      const response = await adminApi.reactivateDoctor(doctorId);
      if (response.success) {
        loadDoctors();
      }
    } catch (error) {
      console.error('Failed to reactivate doctor:', error);
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
        <div className="text-neutral-600">Loading doctors...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL PHYSICIANS */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-primary-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">stethoscope</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">TOTAL PHYSICIANS</div>
              <div className="text-2xl font-bold text-neutral-900 mt-0.5">{stats.total} Doctors</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 border border-primary-100">
            <span className="material-symbols-outlined text-[14px]">verified</span> Licensed
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
            Scheduling Enabled
          </span>
        </div>

        {/* Card 3: PENDING APPROVAL */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-warning-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-warning-50 text-warning-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">schedule</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">PENDING APPROVAL</div>
              <div className="text-2xl font-bold text-warning-700 mt-0.5">{stats.pending} Pending</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-warning-50 text-warning-700 border border-warning-200">
            <span className="material-symbols-outlined text-[14px]">pending</span> Awaiting Review
          </span>
        </div>

        {/* Card 4: REJECTED */}
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-md flex items-center justify-between hover:border-error-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-error-50 text-error-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">cancel</span>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">REJECTED</div>
              <div className="text-2xl font-bold text-error-700 mt-0.5">{stats.rejected} Rejected</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-error-50 text-error-700 border border-error-200">
            <span className="material-symbols-outlined text-[14px]">block</span> Not Approved
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-md flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search Doctor input */}
        <div className="relative w-full lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
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
            <span className="text-xs text-neutral-400 font-medium hidden sm:inline">Specialty:</span>
            <Select
              className="w-44"
              triggerClassName="h-9 px-3 text-xs"
              value={specialtyFilter}
              onChange={setSpecialtyFilter}
              options={[
                { value: 'all', label: 'All Specialties' },
                ...specialties.map(specialty => ({ value: specialty, label: specialty })),
              ]}
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-400 font-medium hidden sm:inline">Status:</span>
            <Select
              className="w-36"
              triggerClassName="h-9 px-3 text-xs"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'Active', label: 'Active' },
                { value: 'Pending', label: 'Pending' },
                { value: 'Rejected', label: 'Rejected' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Doctors Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <colgroup>
              <col className="w-[25%]" />
              <col className="w-[25%]" />
              <col className="w-[25%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Doctor</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Specialty</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">PRC License</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap"></th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Status</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-neutral-500 text-sm">
                    No doctors found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doctor) => (
                  <tr key={doctor.id} className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-semibold text-sm flex-shrink-0">
                          {(doctor.firstName || 'D')[0]}{(doctor.lastName || '')[0]}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 whitespace-nowrap">
                            {doctor.firstName || 'Unknown'} {doctor.lastName || 'Doctor'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="block text-sm text-neutral-700 whitespace-nowrap" title={doctor.specialty || undefined}>
                        {doctor.specialty || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="inline-block text-sm font-mono text-neutral-600 whitespace-nowrap">
                        {doctor.prcLicenseNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                    </td>
                  <td className="px-5 py-4 align-middle">
                    <div className="flex items-center">
                        {doctor.approvalStatus === 'ACTIVE' ? (
                          doctor.isActive === false ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 h-7 rounded-full text-xs font-semibold bg-error-50 text-error-700 border border-error-200 whitespace-nowrap">
                              <span className="material-symbols-outlined text-[14px]">block</span>
                              Inactive
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 h-7 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-success-500"></span>
                              Active
                            </span>
                          )
                        ) : doctor.approvalStatus === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 h-7 rounded-full text-xs font-semibold bg-warning-50 text-warning-700 border border-warning-200 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[14px]">schedule</span>
                            Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 h-7 rounded-full text-xs font-semibold bg-error-50 text-error-700 border border-error-200 whitespace-nowrap">
                            <span className="material-symbols-outlined text-[14px]">cancel</span>
                            Rejected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDoctor(doctor.id)}
                          className="px-3 h-8 text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
                        >
                          View
                        </button>
                        {doctor.approvalStatus === 'ACTIVE' && doctor.isActive !== false && (
                          <button
                            onClick={() => handleDeactivateDoctor(doctor)}
                            className="px-3 h-8 text-xs font-semibold text-error-700 bg-error-50 hover:bg-error-100 border border-error-200 rounded-lg transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                        {doctor.approvalStatus === 'ACTIVE' && doctor.isActive === false && (
                          <button
                            onClick={() => handleReactivateDoctor(doctor.id)}
                            className="px-3 h-8 text-xs font-semibold text-success-700 bg-success-50 hover:bg-success-100 border border-success-200 rounded-lg transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
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
      {detailModalPresent && selectedDoctor && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={detailModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            data-state={detailModalOpen ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-neutral-200 bg-gradient-to-r from-neutral-50 to-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">Doctor Review</h2>
                  <p className="text-sm text-neutral-500 mt-1">Review and approve doctor application</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setDoctorSchedules([]);
                  }}
                  className="text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">

              {/* Basic Information Section */}
              <div className="bg-gradient-to-br from-primary-50 to-neutral-50 rounded-2xl p-5 border border-primary-100">
                <h3 className="text-xl font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary-600">person</span>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">First Name</label>
                    <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.firstName || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Middle Name</label>
                    <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.middleName || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Last Name</label>
                    <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.lastName || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Email Address</label>
                    <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.email || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Email Verified</label>
                    <p className="text-sm font-medium mt-1">
                      {selectedDoctor.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-success-600">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Yes
                        </span>
                      ) : (
                        <span className="text-error-600">No</span>
                      )}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Contact Number</label>
                    <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.contactNumber || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Professional Information Section */}
              <div className="bg-gradient-to-br from-success-50 to-neutral-50 rounded-2xl p-5 border border-success-100">
                <h3 className="text-xl font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-success-600">medical_services</span>
                  Professional Information
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide block mb-2">Professional Photo</label>
                      {selectedDoctor.professionalPhotoUrl ? (
                        <button
                          onClick={() => setShowPhotoModal(true)}
                          className="cursor-pointer hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={selectedDoctor.professionalPhotoUrl}
                            alt="Professional Photo"
                            className="w-28 h-28 rounded-full object-cover border-2 border-neutral-200 shadow-md"
                            onError={(e) => {
                              console.error('Image failed to load:', e.currentTarget.src);
                              console.error('Professional photo URL:', selectedDoctor.professionalPhotoUrl);
                            }}
                          />
                        </button>
                      ) : (
                        <div className="w-28 h-28 rounded-full border-2 border-dashed border-neutral-300 bg-neutral-100 flex items-center justify-center">
                          <span className="text-xs text-neutral-400">No photo</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Specialty</label>
                        <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.specialty || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Credentials</label>
                        <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.credentials || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">PRC License Number</label>
                        <p className="text-sm font-mono font-medium text-neutral-900 mt-1">{selectedDoctor.prcLicenseNumber || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Hospital/Clinic</label>
                        <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.practiceName || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Years of Experience</label>
                        <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.yearsOfExperience || 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Consultation Fee</label>
                        <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.consultationFee ? `₱${selectedDoctor.consultationFee}` : 'N/A'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-neutral-200">
                        <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Languages Spoken</label>
                        <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.languagesSpoken || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Areas of Expertise</label>
                    <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.areasOfExpertise || 'N/A'}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Short Biography</label>
                    <p className="text-sm font-medium text-neutral-900 mt-1 leading-relaxed">{selectedDoctor.biography || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Available Schedule Section */}
              <div className="bg-gradient-to-br from-warning-50 to-neutral-50 rounded-2xl p-5 border border-warning-100">
                <h3 className="text-xl font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-warning-600">schedule</span>
                  Available Schedule
                </h3>
                {isLoadingSchedules ? (
                  <p className="text-sm text-neutral-500">Loading schedules...</p>
                ) : doctorSchedules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {doctorSchedules.map((schedule) => (
                      <div key={schedule.id} className="bg-white rounded-lg p-3 border border-neutral-200 flex items-center justify-between">
                        <div>
                          <span className="text-sm font-semibold text-neutral-900">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][schedule.dayOfWeek]}</span>
                        </div>
                        <div className="text-sm text-neutral-600 font-medium">
                          {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 italic">No schedules configured</p>
                )}
              </div>

              {/* Status Section */}
              <div className="bg-gradient-to-br from-primary-50 to-neutral-50 rounded-2xl p-5 border border-primary-100">
                <h3 className="text-xl font-bold text-neutral-800 mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary-600">info</span>
                  Account Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Approval Status</label>
                    <p className="text-sm font-medium mt-1">
                      {selectedDoctor.approvalStatus === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-50 text-success-700 border border-success-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-success-500"></span>
                          Active
                        </span>
                      ) : selectedDoctor.approvalStatus === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-50 text-warning-700 border border-warning-200">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-error-50 text-error-700 border border-error-200">
                          <span className="material-symbols-outlined text-[14px]">cancel</span>
                          Rejected
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Profile Completion Status</label>
                    <p className="text-sm font-medium text-neutral-900 mt-1">{selectedDoctor.profileCompletionStatus || 'N/A'}</p>
                  </div>
                  {selectedDoctor.rejectionReason && (
                    <div className="bg-white rounded-lg p-3 border border-neutral-200 md:col-span-2">
                      <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Rejection Reason</label>
                      <p className="text-sm font-medium text-error-700 mt-1">{selectedDoctor.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
            <div className="p-6 border-t border-neutral-200 bg-neutral-50 flex justify-between gap-3">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDoctorSchedules([]);
                }}
                className="px-5 py-2.5 text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors shadow-md"
              >
                Close
              </button>
              {selectedDoctor.approvalStatus === 'PENDING' && (
                <div className="flex gap-3">
                  <button
                    onClick={handleRejectDoctor}
                    className="px-5 py-2.5 text-sm font-semibold text-error-700 bg-white hover:bg-error-50 border border-error-300 rounded-lg transition-colors shadow-md"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setShowApproveConfirm(true)}
                    className="px-5 py-2.5 text-sm font-semibold text-success-700 bg-white hover:bg-success-50 border border-success-300 rounded-lg transition-colors shadow-md"
                  >
                    Approve
                  </button>
                </div>
              )}
              {selectedDoctor.approvalStatus === 'ACTIVE' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeactivateDoctor(selectedDoctor)}
                    className="px-5 py-2.5 text-sm font-semibold text-error-700 bg-white hover:bg-error-50 border border-error-300 rounded-lg transition-colors shadow-md"
                  >
                    Deactivate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={showRejectModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-md w-full shadow-xl"
            data-state={showRejectModal ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900">Reject Doctor Application</h2>
              <p className="text-sm text-neutral-500 mt-1">Please provide a reason for rejection</p>
            </div>
            <div className="p-6">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                rows={4}
                className="block w-full rounded-2xl border border-neutral-300 bg-white py-3 px-4 text-sm text-neutral-900 placeholder-neutral-400 focus:border-error-500 focus:outline-none focus:ring-2 focus:ring-error-500/20 transition-all resize-none"
              />
            </div>
            <div className="p-6 border-t border-neutral-200 flex justify-end gap-3">
              <button
                onClick={cancelRejectDoctor}
                className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRejectDoctor}
                className="px-4 py-2 text-sm font-semibold text-white bg-error-600 hover:bg-error-700 rounded-lg transition-colors"
              >
                Reject Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivateModalPresent && selectedDoctor && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={deactivateModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-md w-full shadow-xl"
            data-state={deactivateModalOpen ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900">Deactivate Doctor Account</h2>
              <p className="text-sm text-neutral-500 mt-1">Are you sure you want to deactivate this doctor?</p>
            </div>
            <div className="p-6">
              <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
                <p className="text-sm text-warning-800 font-medium mb-2">This action will:</p>
                <ul className="text-sm text-warning-700 list-disc list-inside space-y-1">
                  <li>Prevent the doctor from logging in</li>
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
                onClick={confirmDeactivateDoctor}
                className="px-4 py-2 text-sm font-semibold text-white bg-error-600 hover:bg-error-700 rounded-lg transition-colors"
              >
                Deactivate Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {photoModalPresent && selectedDoctor?.professionalPhotoUrl && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          data-state={photoModalOpen ? 'open' : 'closed'}
          onClick={() => setShowPhotoModal(false)}
        >
          <div
            className="fmd-modal-panel relative max-w-4xl max-h-[90vh]"
            data-state={photoModalOpen ? 'open' : 'closed'}
          >
            <button
              onClick={() => setShowPhotoModal(false)}
              className="absolute -top-10 right-0 text-white hover:text-neutral-300 transition-colors"
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

      <ConfirmDialog
        open={showApproveConfirm && selectedDoctor !== null}
        title="Approve doctor?"
        message="Are you sure you want to approve this doctor account? Once confirmed, the doctor will be authorized to sign in and access the Doctor Dashboard."
        confirmLabel="Approve"
        confirmVariant="primary"
        busy={isApproving}
        onConfirm={() => void handleApproveDoctor()}
        onCancel={() => setShowApproveConfirm(false)}
      />

      <ConfirmDialog
        open={infoDialog !== null}
        mode="info"
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        onConfirm={() => setInfoDialog(null)}
        onCancel={() => setInfoDialog(null)}
      />
    </div>
  );
}