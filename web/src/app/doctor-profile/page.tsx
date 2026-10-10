'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi } from '@/lib/api/doctorApi';
import type { DoctorProfile, UpdateProfileRequest } from '@/lib/api/doctorApi';
import { CEBU_FACILITIES } from '@/data/cebuFacilities';
import { MEDICAL_SPECIALTIES } from '@/data/medicalSpecialties';
import { MEDICAL_CREDENTIALS } from '@/data/medicalCredentials';
import { MEDICAL_EXPERTISE } from '@/data/medicalExpertise';
import { LANGUAGES } from '@/data/languages';
import SearchableSelect from '@/components/ui/SearchableSelect';
import SearchableMultiSelect from '@/components/ui/SearchableMultiSelect';

const PRC_LICENSE_PATTERN = /^\d{7}$/;

export default function DoctorProfile() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);

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
    languages_spoken: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

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

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Cebu hospital and clinic options for dropdown with area sublabels
  const cebuFacilityOptions = CEBU_FACILITIES.map((facility) => ({
    value: facility.name,
    label: facility.name,
    sublabel: `${facility.type} • ${facility.area}`,
  }));

  // Medical expertise options for dropdown
  const expertiseOptions = MEDICAL_EXPERTISE.map((expertise) => ({
    value: expertise,
    label: expertise,
  }));

  // Language options for dropdown
  const languageOptions = LANGUAGES.map((language) => ({
    value: language,
    label: language,
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
          languages_spoken: response.data.languages_spoken || '',
        });
        if (response.data.professional_photo_url) {
          setPhotoPreview(
            response.data.professional_photo_url.startsWith('http')
              ? response.data.professional_photo_url
              : `http://localhost:3000${response.data.professional_photo_url}`
          );
        }
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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    // Client-side validation
    if (file.type !== 'image/png') {
      setError('Only PNG files are allowed');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError('File size exceeds 4MB limit');
      return;
    }

    // Show immediate preview before upload
    const previewUrl = URL.createObjectURL(file);
    console.log('Preview URL created:', previewUrl);
    setPhotoPreview(previewUrl);

    setIsUploadingPhoto(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/doctor-login');
        return;
      }

      const uploadFormData = new FormData();
      uploadFormData.append('photo', file);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/doctors/me/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: uploadFormData,
      });

      const data = await response.json();
      console.log('Upload response:', data);

      if (response.ok && data.success) {
        // Keep the blob URL as preview (it always works)
        // Only update the form data with the server URL
        setFormData({ ...formData, professional_photo_url: data.data.photoUrl });
        console.log('Photo uploaded, keeping blob preview:', previewUrl);
        setSuccessMessage('Photo uploaded successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        // Clean up the temporary preview URL on error
        URL.revokeObjectURL(previewUrl);
        setPhotoPreview(null);
        console.error('Upload error details:', data);
        setError(data.error?.message || data.error || 'Failed to upload photo. Please try again.');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      // Clean up the temporary preview URL on error
      URL.revokeObjectURL(previewUrl);
      setPhotoPreview(null);
      setError('An error occurred while uploading your photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    setIsDeletingPhoto(true);
    setError('');

    try {
      const response = await doctorApi.deletePhoto();

      if (response.success) {
        setPhotoPreview(null);
        setFormData({ ...formData, professional_photo_url: '' });
        setSuccessMessage('Photo deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.error || 'Failed to delete photo');
      }
    } catch (err) {
      console.error('Photo deletion error:', err);
      setError('An error occurred while deleting your photo');
    } finally {
      setIsDeletingPhoto(false);
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
      // First, save the profile
      const updatePayload: UpdateProfileRequest = {
        specialty: formData.specialty || undefined,
        credentials: formData.credentials || undefined,
        prc_license_number: formData.prc_license_number || undefined,
        practice_name: formData.practice_name || undefined,
        years_of_experience: formData.years_of_experience ? parseInt(formData.years_of_experience) : undefined,
        areas_of_expertise: formData.areas_of_expertise || undefined,
        biography: formData.biography || undefined,
        consultation_fee: formData.consultation_fee ? parseFloat(formData.consultation_fee) : undefined,
        languages_spoken: formData.languages_spoken || undefined,
        professional_photo_url: formData.professional_photo_url || undefined,
      };

      const saveResponse = await doctorApi.updateProfile(updatePayload);

      if (!saveResponse.success) {
        setError(saveResponse.error || 'Failed to save profile');
        return;
      }

      // Then, submit for approval
      const response = await doctorApi.submitProfile();

      if (response.success) {
        // Reload profile to get updated status
        await loadProfile();
        // Show confirmation modal
        setShowSubmissionModal(true);
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

  const handleModalContinue = () => {
    setShowSubmissionModal(false);
    router.push('/doctor/dashboard');
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
  const isRejected = profile?.approval_status === 'REJECTED';
  const isPending = profile?.approval_status === 'PENDING';

  // When REJECTED, allow editing even if profile_completion_status is SUBMITTED
  const canEdit = !isProfileSubmitted || isRejected;
  const canSubmit = !isProfileSubmitted || isRejected;

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
            {isRejected && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-900">Profile Rejected</p>
                    {profile?.rejection_reason && (
                      <p className="text-sm text-red-700 mt-1">Reason: {profile.rejection_reason}</p>
                    )}
                    <p className="text-sm text-red-700 mt-1">Please correct your profile information and resubmit for approval.</p>
                  </div>
                </div>
              </div>
            )}

            {isProfileSubmitted && !isRejected && (
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
                  Professional Photo
                </label>
                <div className="space-y-3">
                  {photoPreview ? (
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setShowPhotoModal(true)}
                        className="cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={photoPreview.startsWith('http') || photoPreview.startsWith('blob:')
                            ? photoPreview
                            : `http://localhost:3000${photoPreview}`}
                          alt="Professional Photo Preview"
                          className="w-32 h-32 rounded-xl object-cover border-2 border-[#E2E8F0]"
                          onError={(e) => {
                            console.error('Image failed to load:', photoPreview);
                            console.error('Error event:', e);
                          }}
                          onLoad={() => {
                            console.log('Image loaded successfully:', photoPreview);
                          }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={handlePhotoDelete}
                        disabled={isDeletingPhoto || !canEdit}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isDeletingPhoto ? '...' : '×'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center w-32 h-32 rounded-xl border-2 border-dashed border-[#E2E8F0] bg-gray-50">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/png"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto || !canEdit}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1A62CD] file:text-white hover:file:bg-[#0D3B75] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      JPEG, PNG, GIF, WebP, BMP (max 4MB)
                    </p>
                  </div>
                </div>
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
                <select
                  value={formData.areas_of_expertise}
                  onChange={(e) => {
                    setFormData({ ...formData, areas_of_expertise: e.target.value });
                    setError('');
                  }}
                  className="block w-full rounded-2xl border border-[#E2E8F0] bg-white py-3.5 px-4 text-[15px] text-gray-900 focus:border-[#1A62CD] focus:outline-none focus:ring-2 focus:ring-[#1A62CD]/20 transition-all"
                >
                  <option value="">Select area of expertise</option>
                  {expertiseOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
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

              {/* Languages Spoken */}
              <div>
                <label className="block text-[15px] font-semibold text-[#334155] mb-2">
                  Languages Spoken
                </label>
                <SearchableMultiSelect
                  value={
                    formData.languages_spoken
                      ? formData.languages_spoken.split(',').map((l) => l.trim()).filter(Boolean)
                      : []
                  }
                  onChange={(selectedList) => {
                    setFormData({ ...formData, languages_spoken: selectedList.join(', ') });
                    setError('');
                  }}
                  options={languageOptions}
                  placeholder="Search & select languages you speak..."
                  noResultsText="No matching languages found"
                />
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
                    disabled={!canEdit}
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
                        className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 focus:border-[#1A62CD] focus:outline-none focus:ring-1 focus:ring-[#1A62CD]/20"
                      >
                        <option value="" className="text-gray-500">Select day</option>
                        {dayOptions.map((day) => (
                          <option key={day.value} value={day.value} className="text-gray-900">{day.label}</option>
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
                          className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 focus:border-[#1A62CD] focus:outline-none focus:ring-1 focus:ring-[#1A62CD]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                        <input
                          type="time"
                          value={scheduleForm.end_time}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                          className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-sm text-gray-900 focus:border-[#1A62CD] focus:outline-none focus:ring-1 focus:ring-[#1A62CD]/20"
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
                            {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          disabled={!canEdit}
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
              <div className="pt-4">
                {canSubmit && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
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

      {/* Submission Confirmation Modal */}
      {showSubmissionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-lg border border-[#E2E8F0] p-8 max-w-md w-full">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-[#0F172A] mb-3">
                Profile Submitted Successfully!
              </h2>
              <p className="text-[#64748B] text-[15px] leading-relaxed mb-6">
                Your professional profile has been submitted successfully. Once approved, your doctor profile will be displayed to patients in the FindMyDoctor mobile app.
              </p>
              <button
                onClick={handleModalContinue}
                className="w-full py-3.5 px-4 rounded-xl shadow-sm text-[16px] font-bold text-white bg-[#1A62CD] hover:bg-[#0D3B75] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A62CD] transition-colors duration-150"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && photoPreview && (
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
              src={photoPreview.startsWith('http') || photoPreview.startsWith('blob:')
                ? photoPreview
                : `http://localhost:3000${photoPreview}`}
              alt="Professional Photo"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
