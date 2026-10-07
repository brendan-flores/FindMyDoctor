'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi } from '@/lib/api/doctorApi';
import type { DoctorProfile, UpdateProfileRequest } from '@/lib/api/doctorApi';
import { CEBU_FACILITIES } from '@/data/cebuFacilities';
import { MEDICAL_SPECIALTIES } from '@/data/medicalSpecialties';
import { MEDICAL_CREDENTIALS } from '@/data/medicalCredentials';
import SearchableSelect from '@/components/ui/SearchableSelect';
import SearchableMultiSelect from '@/components/ui/SearchableMultiSelect';

const PRC_LICENSE_PATTERN = /^\d{7}$/;

export default function DoctorProfile() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [formData, setFormData] = useState({
    professional_photo_url: '',
    specialty: '',
    credentials: '',
    prc_license_number: '',
    practice_name: '',
    years_of_experience: '',
    areas_of_expertise: '',
    biography: '',
    consultation_fee: '',
    consultation_type: '',
    languages_spoken: '',
  });

  const [showPassword, setShowPassword] = useState(false);

  // Schedule management state
  const [schedules, setSchedules] = useState<any[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    day_of_week: '',
    start_time: '',
    end_time: '',
  });

  const dayOptions = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
  ];

  const getDayLabel = (dayValue: string) => {
    const day = dayOptions.find(d => d.value === dayValue);
    return day ? day.label : dayValue;
  };

  // Cebu hospital and clinic options for dropdown with area sublabels
  const cebuFacilityOptions = CEBU_FACILITIES.map((facility) => ({
    value: facility.name,
    label: facility.name,
    sublabel: `${facility.type} • ${facility.area}`,
  }));

  // Check if selected facility has room number requirement
  const selectedFacility = CEBU_FACILITIES.find(f => f.name === formData.practice_name);

  useEffect(() => {
    loadProfile();
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/doctor-login');
        return;
      }

      apiClient.setToken(token);

      const response = await doctorApi.getProfile();

      if (response.success && response.data) {
        setProfile(response.data);
        setFormData({
          professional_photo_url: response.data.professional_photo_url || '',
          specialty: response.data.specialty || '',
          credentials: response.data.credentials || '',
          prc_license_number: response.data.prc_license_number || '',
          practice_name: response.data.practice_name || '',
          years_of_experience: response.data.years_of_experience?.toString() || '',
          areas_of_expertise: response.data.areas_of_expertise || '',
          biography: response.data.biography || '',
          consultation_fee: response.data.consultation_fee?.toString() || '',
          consultation_type: response.data.consultation_type || '',
          languages_spoken: response.data.languages_spoken || '',
        });
      } else {
        setError(response.error || 'Failed to load profile');
      }
    } catch (err) {
      console.error('Load profile error:', err);
      setError('An error occurred while loading your profile');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const response = await doctorApi.getSchedules();
      if (response.success && response.data) {
        setSchedules(response.data);
      }
    } catch (err) {
      console.error('Load schedules error:', err);
    }
  };

  const handleAddSchedule = async () => {
    try {
      const payload = {
        day_of_week: parseInt(scheduleForm.day_of_week),
        start_time: scheduleForm.start_time,
        end_time: scheduleForm.end_time,
        consultation_duration_minutes: 30,
        is_active: true,
      };
      const response = await doctorApi.createSchedule(payload);
      if (response.success) {
        setScheduleForm({
          day_of_week: '',
          start_time: '',
          end_time: '',
        });
        setShowScheduleForm(false);
        await loadSchedules();
      } else {
        setError(response.error || 'Failed to add schedule');
      }
    } catch (err) {
      console.error('Add schedule error:', err);
      setError('An error occurred while adding schedule');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const response = await doctorApi.deleteSchedule(id);
      if (response.success) {
        await loadSchedules();
      } else {
        setError(response.error || 'Failed to delete schedule');
      }
    } catch (err) {
      console.error('Delete schedule error:', err);
      setError('An error occurred while deleting schedule');
    }
  };

  const validateForSubmission = (): string => {
    if (!profile?.first_name) {
      return 'First Name is required';
    }
    if (!profile?.last_name) {
      return 'Last Name is required';
    }
    if (!profile?.contact_number) {
      return 'Contact Number is required';
    }
    if (!formData.specialty.trim()) {
      return 'Specialty is required';
    }
    if (!formData.credentials.trim()) {
      return 'Credentials are required';
    }
    if (!formData.prc_license_number.trim()) {
      return 'PRC License Number is required';
    }
    if (!PRC_LICENSE_PATTERN.test(formData.prc_license_number.trim())) {
      return 'PRC License Number must be 7 digits';
    }
    if (!formData.practice_name.trim()) {
      return 'Hospital/Clinic is required';
    }
    return '';
  };

  const handleSave = async () => {
    setError('');
    setSuccessMessage('');
    setIsSaving(true);

    try {
      const updatePayload: UpdateProfileRequest = {
        specialty: formData.specialty || undefined,
        credentials: formData.credentials || undefined,
        prc_license_number: formData.prc_license_number || undefined,
        practice_name: formData.practice_name || undefined,
        years_of_experience: formData.years_of_experience ? parseInt(formData.years_of_experience) : undefined,
        areas_of_expertise: formData.areas_of_expertise || undefined,
        biography: formData.biography || undefined,
        consultation_fee: formData.consultation_fee ? parseFloat(formData.consultation_fee) : undefined,
        consultation_type: formData.consultation_type || undefined,
        languages_spoken: formData.languages_spoken || undefined,
        professional_photo_url: formData.professional_photo_url || undefined,
      };

      const response = await doctorApi.updateProfile(updatePayload);

      if (response.success && response.data) {
        setProfile(response.data);
        setSuccessMessage('Profile saved successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Save profile error:', err);
      setError('An error occurred while saving your profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccessMessage('');

    const validationError = validateForSubmission();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await doctorApi.submitProfile();

      if (response.success) {
        setSuccessMessage('Profile submitted successfully. Please wait for admin approval.');
        // Reload profile to get updated status
        await loadProfile();
      } else {
        setError(response.error || 'Failed to submit profile');
      }
    } catch (err) {
      console.error('Submit profile error:', err);
      setError('An error occurred while submitting your profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F3F5F9] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A62CD] mx-auto"></div>
          <p className="mt-4 text-[#64748B]">Loading your profile...</p>
        </div>
      </div>
    );
  }

  const isProfileComplete = profile?.profile_completion_status === 'COMPLETE' || profile?.profile_completion_status === 'SUBMITTED';
  const isProfileSubmitted = profile?.profile_completion_status === 'SUBMITTED';

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <div className="px-4 py-8 overflow-y-auto" style={{ height: '100vh' }}>
        <div className="w-full max-w-[560px] mx-auto">

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2.5 mb-1.5">
              <div className="w-12 h-12 bg-[#1A62CD] rounded-2xl flex items-center justify-center shadow-sm">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <line x1="12" x2="12" y1="5" y2="19" />
                  <line x1="5" x2="19" y1="12" y2="12" />
                </svg>
              </div>
              <span className="text-4xl font-extrabold tracking-tight text-[#165CBE]">
                FiDo
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#8392A5] tracking-[0.18em] uppercase">
              FIND A DOCTOR
            </span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-lg border border-[#E2E8F0] p-8">

            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-[#0F172A]">
                Complete Your Professional Profile
              </h1>
              <p className="text-[#64748B] mt-2 text-[15px]">
                Please provide your professional information. Once complete, submit for admin approval.
              </p>
            </div>

            {/* Status Banner */}
            {isProfileSubmitted && (
              <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Profile Submitted for Review</p>
                    <p className="text-sm text-blue-700 mt-1">Your profile is pending admin approval. You will be notified once approved.</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                {successMessage}
              </div>
            )}

            {/* Form */}
            <div className="space-y-5">

              {/* Professional Photo */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Professional Photo URL
                </label>
                <input
                  type="url"
                  value={formData.professional_photo_url}
                  onChange={(e) => {
                    setFormData({ ...formData, professional_photo_url: e.target.value });
                    setError('');
                  }}
                  placeholder="https://example.com/photo.jpg"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter a URL to your professional photo. Image upload will be available in a future update.
                </p>
              </div>

              {/* Specialty */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Specialty <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={formData.specialty}
                  onChange={(val) => {
                    setFormData({ ...formData, specialty: val });
                    setError('');
                  }}
                  options={MEDICAL_SPECIALTIES}
                  placeholder="Search and select medical specialty..."
                  noResultsText="No matching medical specialties found"
                />
              </div>

              {/* Credentials */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Credentials <span className="text-red-500">*</span>
                </label>
                <SearchableMultiSelect
                  value={
                    formData.credentials
                      ? formData.credentials.split(',').map((c) => c.trim()).filter(Boolean)
                      : []
                  }
                  onChange={(selectedList) => {
                    setFormData({ ...formData, credentials: selectedList.join(', ') });
                    setError('');
                  }}
                  options={MEDICAL_CREDENTIALS}
                  placeholder="Search & select credentials (e.g., MD, FPCP, FPSGS)..."
                  noResultsText="No matching physician credentials found"
                />
              </div>

              {/* PRC License Number */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  PRC License Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  value={formData.prc_license_number}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, prc_license_number: numericValue });
                    setError('');
                  }}
                  placeholder="Enter your 7-digit PRC license number"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Hospital/Clinic */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Hospital/Clinic <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={formData.practice_name}
                  onChange={(val) => {
                    setFormData({ ...formData, practice_name: val });
                    setError('');
                  }}
                  options={cebuFacilityOptions}
                  placeholder="Search and select Cebu hospital or clinic..."
                  noResultsText="No matching hospital or clinic found in Cebu"
                />
              </div>

              {/* Years of Experience */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Years of Experience
                </label>
                <input
                  type="number"
                  min="0"
                  max="70"
                  value={formData.years_of_experience}
                  onChange={(e) => {
                    setFormData({ ...formData, years_of_experience: e.target.value });
                    setError('');
                  }}
                  placeholder="e.g., 10"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Areas of Expertise */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Areas of Expertise
                </label>
                <input
                  type="text"
                  value={formData.areas_of_expertise}
                  onChange={(e) => {
                    setFormData({ ...formData, areas_of_expertise: e.target.value });
                    setError('');
                  }}
                  placeholder="e.g., Diabetes, Hypertension, Cardiology"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Separate multiple areas with commas
                </p>
              </div>

              {/* Short Biography */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Short Biography
                </label>
                <textarea
                  value={formData.biography}
                  onChange={(e) => {
                    setFormData({ ...formData, biography: e.target.value });
                    setError('');
                  }}
                  placeholder="Tell patients about your background and approach to care..."
                  rows={4}
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all resize-none"
                />
              </div>

              {/* Consultation Fee */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Consultation Fee (₱)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.consultation_fee}
                  onChange={(e) => {
                    setFormData({ ...formData, consultation_fee: e.target.value });
                    setError('');
                  }}
                  placeholder="e.g., 500"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
              </div>

              {/* Consultation Type */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Consultation Type
                </label>
                <select
                  value={formData.consultation_type}
                  onChange={(e) => {
                    setFormData({ ...formData, consultation_type: e.target.value });
                    setError('');
                  }}
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                >
                  <option value="">Select consultation type</option>
                  <option value="In-Person">In-Person</option>
                  <option value="Online">Online</option>
                  <option value="Both">Both In-Person and Online</option>
                </select>
              </div>

              {/* Languages Spoken */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Languages Spoken
                </label>
                <input
                  type="text"
                  value={formData.languages_spoken}
                  onChange={(e) => {
                    setFormData({ ...formData, languages_spoken: e.target.value });
                    setError('');
                  }}
                  placeholder="e.g., English, Cebuano, Tagalog"
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 placeholder-[#94A3B8] focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Separate multiple languages with commas
                </p>
              </div>

              {/* Available Schedule */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[15px] font-semibold text-[#334155]">
                    Available Schedule
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowScheduleForm(!showScheduleForm)}
                    disabled={isProfileSubmitted}
                    className="text-sm font-semibold text-[#1967D2] hover:text-[#0D3B75] disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {showScheduleForm ? 'Cancel' : '+ Add Schedule'}
                  </button>
                </div>

                {/* Schedule Form */}
                {showScheduleForm && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                      <select
                        value={scheduleForm.day_of_week}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_week: e.target.value })}
                        className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm focus:border-[#1A62CD] focus:outline-none focus:ring-1 focus:ring-[#1A62CD]/20"
                      >
                        <option value="">Select day</option>
                        {dayOptions.map((day) => (
                          <option key={day.value} value={day.value}>{day.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={scheduleForm.start_time}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                          className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm focus:border-[#1A62CD] focus:outline-none focus:ring-1 focus:ring-[#1A62CD]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                        <input
                          type="time"
                          value={scheduleForm.end_time}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                          className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm focus:border-[#1A62CD] focus:outline-none focus:ring-1 focus:ring-[#1A62CD]/20"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSchedule}
                      disabled={!scheduleForm.day_of_week || !scheduleForm.start_time || !scheduleForm.end_time}
                      className="w-full py-2 px-4 rounded-lg text-sm font-semibold text-white bg-[#1A62CD] hover:bg-[#0D3B75] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Add Schedule
                    </button>
                  </div>
                )}

                {/* Schedule List */}
                {schedules.length > 0 ? (
                  <div className="space-y-2">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div className="text-sm">
                          <span className="font-medium text-gray-900">{getDayLabel(schedule.day_of_week?.toString())}</span>
                          <span className="text-gray-600 ml-2">
                            {schedule.start_time?.substring(0, 5)} - {schedule.end_time?.substring(0, 5)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          disabled={isProfileSubmitted}
                          className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No schedules added yet</p>
                )}
              </div>

              {/* Buttons */}
              <div className="pt-4 space-y-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || isProfileSubmitted}
                  className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#1A62CD] hover:bg-[#0D3B75] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A62CD] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Profile'}
                </button>

                {!isProfileSubmitted && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting || isSaving}
                    className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#0D3B75] hover:bg-[#092B57] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0D3B75] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                  </button>
                )}
              </div>

            </div>

          </div>

          <p className="text-center text-[13px] text-[#94A3B8] mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>

        </div>
      </div>
    </div>
  );
}
