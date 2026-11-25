'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi, DoctorProfile, type DoctorDashboard } from '@/lib/api/doctorApi';
import Toast from '@/components/ui/Toast';
import TwoFactorBanner from '@/components/settings/TwoFactorBanner';
import { usePresence } from '@/hooks/usePresence';

export default function DoctorDashboard() {
  const router = useRouter();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [dashboardData, setDashboardData] = useState<DoctorDashboard | null>(null);
  const [dashboardError, setDashboardError] = useState('');

  // Add Secretary modal state
  const [showAddSecretaryModal, setShowAddSecretaryModal] = useState(false);
  const addSecretaryModalPresent = usePresence(showAddSecretaryModal);
  const [secretaryForm, setSecretaryForm] = useState({
    email: '',
    password: '',
  });
  const [isCreatingSecretary, setIsCreatingSecretary] = useState(false);
  const [secretaryError, setSecretaryError] = useState('');
  const [secretarySuccess, setSecretarySuccess] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    const checkApprovalStatus = async () => {
      const token = apiClient.getStoredToken();

      if (!token) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        apiClient.clearToken();
        router.push('/doctor-login');
        return;
      }

      apiClient.setToken(token);

      try {
        // Fetch the profile (approval-status gate) and dashboard data in
        // parallel instead of sequentially. Previously the dashboard request
        // only started after the profile round trip finished, and the profile
        // was also fetched by the layout. Parallel loading makes the initial
        // dashboard load closer to max(profile, dashboard) rather than their sum.
        const [profileResponse, dashboardResponse] = await Promise.all([
          doctorApi.getProfile({ signal: controller.signal }),
          doctorApi.getDashboard(undefined, { signal: controller.signal }),
        ]);

        if (controller.signal.aborted) return;

        if (profileResponse.success && profileResponse.data) {
          const approvalStatus = profileResponse.data.approval_status;

          if (approvalStatus === 'ACTIVE') {
            setProfile(profileResponse.data);
            setIsLoadingAuth(false);
            if (dashboardResponse.success && dashboardResponse.data) {
              setDashboardData(dashboardResponse.data);
            } else {
              setDashboardError(dashboardResponse.error || 'Failed to load dashboard data');
            }
            setIsLoadingDashboard(false);
          } else if (approvalStatus === 'REJECTED') {
            router.push('/doctor-profile');
            setIsLoadingAuth(false);
            setIsLoadingDashboard(false);
          } else if (approvalStatus === 'PENDING') {
            // PENDING doctors who have not submitted their professional profile
            // must complete it instead of being signed out.
            router.push('/doctor-profile');
            setIsLoadingAuth(false);
            setIsLoadingDashboard(false);
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            apiClient.clearToken();
            router.push('/doctor-login');
            setIsLoadingAuth(false);
            setIsLoadingDashboard(false);
          }
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          apiClient.clearToken();
          router.push('/doctor-login');
          setIsLoadingAuth(false);
          setIsLoadingDashboard(false);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Error checking approval status:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        apiClient.clearToken();
        router.push('/doctor-login');
        setIsLoadingAuth(false);
        setIsLoadingDashboard(false);
      }
    };

    checkApprovalStatus();

    return () => controller.abort();
  }, [router]);

  const loadDashboardData = async (signal?: AbortSignal) => {
    setIsLoadingDashboard(true);
    setDashboardError('');

    try {
      const response = await doctorApi.getDashboard(undefined, { signal });
      if (signal?.aborted) return;
      if (response.success && response.data) {
        setDashboardData(response.data);
      } else {
        setDashboardError(response.error || 'Failed to load dashboard data');
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Error loading dashboard:', err);
      setDashboardError('Failed to load dashboard data');
    } finally {
      if (!signal?.aborted) {
        setIsLoadingDashboard(false);
      }
    }
  };

  const handleAddSecretary = async () => {
    // Basic validation
    if (!secretaryForm.email || !secretaryForm.password) {
      setSecretaryError('Email and password are required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(secretaryForm.email)) {
      setSecretaryError('Invalid email format');
      return;
    }

    setIsCreatingSecretary(true);
    setSecretaryError('');
    setSecretarySuccess('');

    try {
      const response = await apiClient.post('/doctors/secretaries', {
        email: secretaryForm.email,
        password: secretaryForm.password,
      });

      if (response.success) {
        setSecretarySuccess('Secretary created successfully');
        setSecretaryForm({ email: '', password: '' });
        setTimeout(() => {
          setShowAddSecretaryModal(false);
        }, 2000);
      } else {
        setSecretaryError(response.error || 'Failed to create secretary');
      }
    } catch (err) {
      setSecretaryError('Failed to create secretary');
    } finally {
      setIsCreatingSecretary(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-neutral-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoadingDashboard) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-neutral-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-error-400 mb-3">error</span>
          <p className="text-lg font-semibold text-neutral-800 mb-2">Failed to load dashboard</p>
          <p className="text-sm text-neutral-600 mb-4">{dashboardError}</p>
          <button
            onClick={() => loadDashboardData()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {profile?.two_factor_enabled === false && (
        <TwoFactorBanner settingsHref="/doctor/settings" />
      )}

      {/* Metric Cards - Full Width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Today's Appointments */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success-500 to-success-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">calendar_today</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Today&apos;s Appointments</span>
            <span className="text-2xl font-bold text-neutral-800">{dashboardData?.appointmentCounts.waiting || 0}</span>
            <span className="text-xs text-neutral-400">waiting • {dashboardData?.appointmentCounts.completed || 0} completed</span>
          </div>
        </div>

        {/* Capacity Used */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">space_dashboard</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Capacity Used</span>
            <span className="text-2xl font-bold text-neutral-800">{dashboardData?.capacity.used || 0} <span className="text-lg text-neutral-400">of {dashboardData?.capacity.total || 0}</span></span>
            <span className="text-xs text-neutral-400">{dashboardData?.capacity.remaining || 0} remaining</span>
          </div>
        </div>

        {/* Next Patient */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">person</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Next Patient</span>
            {dashboardData?.nextPatient ? (
              <>
                <span className="text-2xl font-bold text-neutral-800 truncate">#{dashboardData.nextPatient.queueNumber}</span>
                <span className="text-xs text-neutral-400 truncate">{dashboardData.nextPatient.patientName}</span>
              </>
            ) : (
              <span className="text-lg font-medium text-neutral-400">No waiting patients</span>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning-500 to-warning-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">event_upcoming</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Upcoming</span>
            <span className="text-2xl font-bold text-neutral-800">{dashboardData?.upcomingAppointments.length || 0}</span>
            <span className="text-xs text-neutral-400">next 7 days</span>
          </div>
        </div>
      </div>

      {/* Now in checkup */}
      {dashboardData?.nowInCheckup && dashboardData.nowInCheckup.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-neutral-800">Now in checkup</h3>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
              {dashboardData.nowInCheckup.length} patient{dashboardData.nowInCheckup.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {dashboardData.nowInCheckup.map((patient) => (
              <div
                key={`${patient.appointmentId}-${patient.queueNumber}`}
                className="rounded-xl border border-primary-100 bg-primary-50/50 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                    {patient.queueNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 truncate">{patient.patientName}</p>
                    <p className="text-xs text-neutral-500">
                      Queue #{patient.queueNumber}
                      {patient.startedAt ? ` · since ${new Date(patient.startedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {patient.doctorFinished ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
                      Doctor finished
                    </span>
                  ) : patient.hasDraft ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
                      Draft in progress
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                      Not started
                    </span>
                  )}
                  {patient.appointmentId && (
                    <button
                      onClick={() => router.push(`/doctor/appointments/${patient.appointmentId}`)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    >
                      {patient.doctorFinished
                        ? 'View'
                        : patient.hasDraft
                        ? 'Continue consultation'
                        : 'Start consultation'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Queue */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-6">
        <h3 className="text-xl font-bold text-neutral-800 mb-4">Today&apos;s Queue</h3>
        {dashboardData?.todayQueue && dashboardData.todayQueue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Queue #</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Reason</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.todayQueue.map((queueItem, index) => (
                  <tr
                    key={index}
                    className={queueItem.appointmentId ? 'cursor-pointer hover:bg-neutral-50 transition-colors' : ''}
                    onClick={() => queueItem.appointmentId && router.push(`/doctor/appointments/${queueItem.appointmentId}`)}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-neutral-900">#{queueItem.queueNumber}</td>
                    <td className="py-3 px-4 text-sm text-neutral-700">{queueItem.patientName}</td>
                    <td className="py-3 px-4 text-sm text-neutral-600 truncate max-w-xs">{queueItem.reason || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        queueItem.status === 'COMPLETED' ? 'bg-success-100 text-success-700' :
                        queueItem.status === 'IN_CHECKUP' ? 'bg-primary-100 text-primary-700' :
                        queueItem.status === 'WAITING' ? 'bg-warning-100 text-warning-700' :
                        queueItem.status === 'CALLED' ? 'bg-primary-100 text-primary-700' :
                        'bg-neutral-100 text-neutral-600'
                      }`}>
                        {queueItem.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">queue</span>
            <p className="text-neutral-600 font-medium">No patients in queue today</p>
          </div>
        )}
      </div>

      {/* Needs a Record */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-6">
        <h3 className="text-xl font-bold text-neutral-800 mb-4">Needs a Record</h3>
        {dashboardData?.consultationsNeedingRecords && dashboardData.consultationsNeedingRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Missing</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.consultationsNeedingRecords.map((consultation, index) => (
                  <tr
                    key={index}
                    className="cursor-pointer hover:bg-neutral-50 transition-colors"
                    onClick={() => router.push(`/doctor/appointments/${consultation.appointmentId}`)}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-neutral-900">{consultation.patientName}</td>
                    <td className="py-3 px-4 text-sm text-neutral-700">{new Date(consultation.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {consultation.missingRecord && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-error-100 text-error-700">
                            Record
                          </span>
                        )}
                        {consultation.missingPrescription && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-error-100 text-error-700">
                            Prescription
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-primary-600 font-medium hover:underline">View Appointment →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">check_circle</span>
            <p className="text-neutral-600 font-medium">No consultations needing records</p>
          </div>
        )}
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-6">
        <h3 className="text-xl font-bold text-neutral-800 mb-4">Upcoming Appointments</h3>
        {dashboardData?.upcomingAppointments && dashboardData.upcomingAppointments.length > 0 ? (
          <div className="space-y-3">
            {dashboardData.upcomingAppointments.map((appointment, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[18px] text-neutral-500">calendar_today</span>
                    <span className="text-sm font-semibold text-neutral-900">{new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <p className="text-sm text-neutral-700">{appointment.patientName}</p>
                  {appointment.reason && <p className="text-xs text-neutral-500 truncate">{appointment.reason}</p>}
                </div>
                <div className="text-right ml-4">
                  {appointment.queueNumber && <span className="text-sm font-medium text-neutral-600">#{appointment.queueNumber}</span>}
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    appointment.status === 'SCHEDULED' ? 'bg-primary-100 text-primary-700' :
                    appointment.status === 'CONFIRMED' ? 'bg-success-100 text-success-700' :
                    'bg-neutral-100 text-neutral-600'
                  }`}>
                    {appointment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">event_busy</span>
            <p className="text-neutral-600 font-medium">No upcoming appointments</p>
          </div>
        )}
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-6">
        <h3 className="text-xl font-bold text-neutral-800 mb-4">Today&apos;s Schedule</h3>
        {dashboardData?.todaySchedule ? (
          <div className="space-y-4">
            {dashboardData.todaySchedule.hasException && dashboardData.todaySchedule.exception ? (
              <div className="bg-error-50 border border-error-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-error-600">event_busy</span>
                  <span className="text-sm font-semibold text-error-900">Exception Today</span>
                </div>
                <p className="text-xs text-error-700">
                  {new Date(dashboardData.todaySchedule.exception.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {dashboardData.todaySchedule.exception.startDate !== dashboardData.todaySchedule.exception.endDate &&
                    ` - ${new Date(dashboardData.todaySchedule.exception.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                  }
                  {dashboardData.todaySchedule.exception.reason && `: ${dashboardData.todaySchedule.exception.reason}`}
                </p>
              </div>
            ) : (
              <>
                {dashboardData.todaySchedule.workingHours.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-neutral-700 mb-2">Working Hours</p>
                    <div className="space-y-1">
                      {dashboardData.todaySchedule.workingHours.map((hours, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-neutral-600">
                          <span className="material-symbols-outlined text-[18px] text-success-600">schedule</span>
                          <span>{hours.start} - {hours.end}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No working hours scheduled for today</p>
                )}

                {dashboardData.todaySchedule.breaks.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-neutral-700 mb-2 mt-4">Break Periods</p>
                    <div className="space-y-1">
                      {dashboardData.todaySchedule.breaks.map((breakPeriod, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-neutral-600">
                          <span className="material-symbols-outlined text-[18px] text-warning-600">free_breakfast</span>
                          <span>{breakPeriod.start} - {breakPeriod.end}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">schedule</span>
            <p className="text-neutral-600 font-medium">No schedule information available</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-6">
        <h3 className="text-xl font-bold text-neutral-800 mb-4">Quick Actions</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => router.push('/doctor/appointments')}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-success-600">calendar_month</span>
            <span className="text-sm font-semibold text-neutral-700">View Appointments</span>
          </button>
          <button
            onClick={() => router.push('/doctor/schedule')}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-warning-600">schedule</span>
            <span className="text-sm font-semibold text-neutral-700">Manage Schedule</span>
          </button>
          <button
            onClick={() => router.push('/doctor/patients')}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-primary-600">people</span>
            <span className="text-sm font-semibold text-neutral-700">Patients</span>
          </button>
          <button
            onClick={() => router.push('/doctor/prescriptions')}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-primary-600">medication</span>
            <span className="text-sm font-semibold text-neutral-700">Prescriptions</span>
          </button>
          <button
            onClick={() => setShowAddSecretaryModal(true)}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-primary-600">badge</span>
            <span className="text-sm font-semibold text-neutral-700">Add Secretary</span>
          </button>
        </div>
      </div>

      {/* Add Secretary Modal */}
      {addSecretaryModalPresent && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4"
          data-state={showAddSecretaryModal ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-neutral-100"
            data-state={showAddSecretaryModal ? 'open' : 'closed'}
          >
            <h3 className="text-2xl font-bold text-neutral-800 mb-6">Add Secretary</h3>
            <div className="space-y-4">
              {secretaryError && (
                <Toast message={secretaryError} type="error" onClose={() => setSecretaryError('')} />
              )}
              {secretarySuccess && (
                <Toast message={secretarySuccess} type="success" onClose={() => setSecretarySuccess('')} />
              )}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">Email</label>
                <input
                  type="email"
                  value={secretaryForm.email}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-500 text-neutral-700 bg-white hover:border-primary-300 transition-all"
                  placeholder="secretary@example.com"
                  disabled={isCreatingSecretary}
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
                  disabled={isCreatingSecretary}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-6">
              <button
                onClick={() => {
                  setShowAddSecretaryModal(false);
                  setSecretaryForm({ email: '', password: '' });
                  setSecretaryError('');
                  setSecretarySuccess('');
                }}
                className="flex-1 px-6 py-3 border-2 border-neutral-200 rounded-xl text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 font-semibold transition-all"
                disabled={isCreatingSecretary}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSecretary}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isCreatingSecretary}
              >
                {isCreatingSecretary ? 'Creating...' : 'Create Secretary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
