'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi, DoctorProfile, type DoctorDashboard } from '@/lib/api/doctorApi';
import Toast from '@/components/ui/Toast';

export default function DoctorDashboard() {
  const router = useRouter();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [dashboardData, setDashboardData] = useState<DoctorDashboard | null>(null);
  const [dashboardError, setDashboardError] = useState('');

  // Add Secretary modal state
  const [showAddSecretaryModal, setShowAddSecretaryModal] = useState(false);
  const [secretaryForm, setSecretaryForm] = useState({
    email: '',
    password: '',
  });
  const [isCreatingSecretary, setIsCreatingSecretary] = useState(false);
  const [secretaryError, setSecretaryError] = useState('');
  const [secretarySuccess, setSecretarySuccess] = useState('');

  useEffect(() => {
    const checkApprovalStatus = async () => {
      const token = localStorage.getItem('doctor_token') || localStorage.getItem('token');

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
        const response = await doctorApi.getProfile();

        if (response.success && response.data) {
          const approvalStatus = response.data.approval_status;

          if (approvalStatus === 'ACTIVE') {
            setProfile(response.data);
            setIsLoadingAuth(false);
            // Load dashboard data from backend
            loadDashboardData();
          } else if (approvalStatus === 'REJECTED') {
            router.push('/doctor-profile');
          } else if (approvalStatus === 'PENDING') {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            apiClient.clearToken();
            router.push('/doctor-login');
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            apiClient.clearToken();
            router.push('/doctor-login');
          }
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          apiClient.clearToken();
          router.push('/doctor-login');
        }
      } catch (err) {
        console.error('Error checking approval status:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        apiClient.clearToken();
        router.push('/doctor-login');
      }
    };

    checkApprovalStatus();
  }, [router]);

  const loadDashboardData = async () => {
    setIsLoadingDashboard(true);
    setDashboardError('');

    try {
      const response = await doctorApi.getDashboard();
      if (response.success && response.data) {
        setDashboardData(response.data);
      } else {
        setDashboardError(response.error || 'Failed to load dashboard data');
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setDashboardError('Failed to load dashboard data');
    } finally {
      setIsLoadingDashboard(false);
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
      <div className="min-h-screen bg-[#F3F5F9] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A62CD] mx-auto"></div>
          <p className="mt-4 text-[#64748B]">Loading...</p>
        </div>
      </div>
    );
  }

  if (isLoadingDashboard) {
    return (
      <div className="min-h-screen bg-[#F3F5F9] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A62CD] mx-auto"></div>
          <p className="mt-4 text-[#64748B]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (dashboardError) {
    return (
      <div className="min-h-screen bg-[#F3F5F9] flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-red-400 mb-3">error</span>
          <p className="text-lg font-semibold text-slate-800 mb-2">Failed to load dashboard</p>
          <p className="text-sm text-slate-600 mb-4">{dashboardError}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-[#1A62CD] text-white rounded-lg hover:bg-[#1555b8] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards - Full Width */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Today's Appointments */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">calendar_today</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Today&apos;s Appointments</span>
            <span className="text-2xl font-bold text-slate-800">{dashboardData?.appointmentCounts.waiting || 0}</span>
            <span className="text-xs text-slate-400">waiting • {dashboardData?.appointmentCounts.completed || 0} completed</span>
          </div>
        </div>

        {/* Capacity Used */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">space_dashboard</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Capacity Used</span>
            <span className="text-2xl font-bold text-slate-800">{dashboardData?.capacity.used || 0} <span className="text-lg text-slate-400">of {dashboardData?.capacity.total || 0}</span></span>
            <span className="text-xs text-slate-400">{dashboardData?.capacity.remaining || 0} remaining</span>
          </div>
        </div>

        {/* Next Patient */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">person</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Next Patient</span>
            {dashboardData?.nextPatient ? (
              <>
                <span className="text-2xl font-bold text-slate-800 truncate">#{dashboardData.nextPatient.queueNumber}</span>
                <span className="text-xs text-slate-400 truncate">{dashboardData.nextPatient.patientName}</span>
              </>
            ) : (
              <span className="text-lg font-medium text-slate-400">No waiting patients</span>
            )}
          </div>
        </div>

        {/* Upcoming Appointments */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-slate-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">event_upcoming</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Upcoming</span>
            <span className="text-2xl font-bold text-slate-800">{dashboardData?.upcomingAppointments.length || 0}</span>
            <span className="text-xs text-slate-400">next 7 days</span>
          </div>
        </div>
      </div>

      {/* Today's Queue */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Today&apos;s Queue</h3>
        {dashboardData?.todayQueue && dashboardData.todayQueue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Queue #</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.todayQueue.map((queueItem, index) => (
                  <tr
                    key={index}
                    className={queueItem.appointmentId ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''}
                    onClick={() => queueItem.appointmentId && router.push(`/doctor/appointments/${queueItem.appointmentId}`)}
                  >
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">#{queueItem.queueNumber}</td>
                    <td className="py-3 px-4 text-sm text-slate-700">{queueItem.patientName}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 truncate max-w-xs">{queueItem.reason || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        queueItem.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        queueItem.status === 'IN_CHECKUP' ? 'bg-blue-100 text-blue-700' :
                        queueItem.status === 'WAITING' ? 'bg-amber-100 text-amber-700' :
                        queueItem.status === 'CALLED' ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-600'
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
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">queue</span>
            <p className="text-slate-600 font-medium">No patients in queue today</p>
          </div>
        )}
      </div>

      {/* Needs a Record - TODO State */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Needs a Record</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-2xl">info</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">Feature Not Yet Implemented</p>
              <p className="text-xs text-amber-700">This section will show completed consultations without visit records or prescriptions once the data structure is established.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Upcoming Appointments</h3>
        {dashboardData?.upcomingAppointments && dashboardData.upcomingAppointments.length > 0 ? (
          <div className="space-y-3">
            {dashboardData.upcomingAppointments.map((appointment, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">calendar_today</span>
                    <span className="text-sm font-semibold text-slate-900">{new Date(appointment.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  </div>
                  <p className="text-sm text-slate-700">{appointment.patientName}</p>
                  {appointment.reason && <p className="text-xs text-slate-500 truncate">{appointment.reason}</p>}
                </div>
                <div className="text-right ml-4">
                  {appointment.queueNumber && <span className="text-sm font-medium text-slate-600">#{appointment.queueNumber}</span>}
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    appointment.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                    appointment.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {appointment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">event_busy</span>
            <p className="text-slate-600 font-medium">No upcoming appointments</p>
          </div>
        )}
      </div>

      {/* Today's Schedule */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Today&apos;s Schedule</h3>
        {dashboardData?.todaySchedule ? (
          <div className="space-y-4">
            {dashboardData.todaySchedule.hasException && dashboardData.todaySchedule.exception ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-red-600">event_busy</span>
                  <span className="text-sm font-semibold text-red-900">Exception Today</span>
                </div>
                <p className="text-xs text-red-700">
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
                    <p className="text-sm font-semibold text-slate-700 mb-2">Working Hours</p>
                    <div className="space-y-1">
                      {dashboardData.todaySchedule.workingHours.map((hours, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-[18px] text-emerald-600">schedule</span>
                          <span>{hours.start} - {hours.end}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No working hours scheduled for today</p>
                )}

                {dashboardData.todaySchedule.breaks.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-700 mb-2 mt-4">Break Periods</p>
                    <div className="space-y-1">
                      {dashboardData.todaySchedule.breaks.map((breakPeriod, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="material-symbols-outlined text-[18px] text-amber-600">free_breakfast</span>
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
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">schedule</span>
            <p className="text-slate-600 font-medium">No schedule information available</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-4">Quick Actions</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => router.push('/doctor/appointments')}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-emerald-600">calendar_month</span>
            <span className="text-sm font-semibold text-slate-700">View Appointments</span>
          </button>
          <button
            onClick={() => router.push('/doctor/schedule')}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-amber-600">schedule</span>
            <span className="text-sm font-semibold text-slate-700">Manage Schedule</span>
          </button>
          <button
            onClick={() => router.push('/doctor/patients')}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-blue-600">people</span>
            <span className="text-sm font-semibold text-slate-700">Patients</span>
          </button>
          <button
            onClick={() => router.push('/doctor/prescriptions')}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-purple-600">medication</span>
            <span className="text-sm font-semibold text-slate-700">Prescriptions</span>
          </button>
          <button
            onClick={() => setShowAddSecretaryModal(true)}
            className="flex-1 min-w-[140px] flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left shadow-sm hover:shadow-md"
          >
            <span className="material-symbols-outlined text-[20px] text-blue-600">badge</span>
            <span className="text-sm font-semibold text-slate-700">Add Secretary</span>
          </button>
        </div>
      </div>

      {/* Add Secretary Modal */}
      {showAddSecretaryModal && (
        <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-slate-800 mb-6">Add Secretary</h3>
            <div className="space-y-4">
              {secretaryError && (
                <Toast message={secretaryError} type="error" onClose={() => setSecretaryError('')} />
              )}
              {secretarySuccess && (
                <Toast message={secretarySuccess} type="success" onClose={() => setSecretarySuccess('')} />
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={secretaryForm.email}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white hover:border-blue-300 transition-all"
                  placeholder="secretary@example.com"
                  disabled={isCreatingSecretary}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Temporary Password</label>
                <input
                  type="password"
                  value={secretaryForm.password}
                  onChange={(e) => setSecretaryForm({ ...secretaryForm, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white hover:border-blue-300 transition-all"
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
                className="flex-1 px-6 py-3 border-2 border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-semibold transition-all"
                disabled={isCreatingSecretary}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSecretary}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
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
