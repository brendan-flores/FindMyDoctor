'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import { doctorApi, DoctorProfile, UpdateProfileRequest } from '@/lib/api/doctorApi';
import { CEBU_FACILITIES } from '@/data/cebuFacilities';
import { MEDICAL_SPECIALTIES } from '@/data/medicalSpecialties';
import { MEDICAL_CREDENTIALS } from '@/data/medicalCredentials';
import { MEDICAL_EXPERTISE } from '@/data/medicalExpertise';
import { LANGUAGES } from '@/data/languages';
import SearchableSelect from '@/components/ui/SearchableSelect';
import SearchableMultiSelect from '@/components/ui/SearchableMultiSelect';

const apiOrigin = new URL(
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'
).origin;

function Detail({ label, value, isEditing, onEdit, disabled, children }: { label: string; value?: string | number | null; isEditing?: boolean; onEdit?: (value: string) => void; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <div className="py-4 last:pb-0">
      <dt className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1.5">
        {children || (
          <span className="whitespace-pre-wrap break-words text-base font-medium text-slate-800">
            {value === null || value === undefined || value === '' ? 'Not provided' : value}
          </span>
        )}
      </dd>
    </div>
  );
}

export default function DoctorProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [editForm, setEditForm] = useState<UpdateProfileRequest & { email?: string }>({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Dropdown options
  const specialtyOptions = MEDICAL_SPECIALTIES.map((specialty) => ({
    value: specialty,
    label: specialty,
  }));

  const credentialsOptions = MEDICAL_CREDENTIALS.map((credential) => ({
    value: credential.value,
    label: credential.label,
    sublabel: credential.description,
  }));

  const cebuFacilityOptions = CEBU_FACILITIES.map((facility) => ({
    value: facility.name,
    label: facility.name,
    sublabel: `${facility.type} • ${facility.area}`,
  }));

  const expertiseOptions = MEDICAL_EXPERTISE.map((expertise) => ({
    value: expertise,
    label: expertise,
  }));

  const languageOptions = LANGUAGES.map((language) => ({
    value: language,
    label: language,
  }));

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/doctor-login');
      return;
    }

    apiClient.setToken(token);
    doctorApi.getProfile()
      .then((response) => {
        if (response.success && response.data) {
          setProfile(response.data);
          setEditForm({
            first_name: response.data.first_name || undefined,
            middle_name: response.data.middle_name || undefined,
            last_name: response.data.last_name || undefined,
            contact_number: response.data.contact_number || undefined,
            email: response.data.email || undefined,
            specialty: response.data.specialty || undefined,
            credentials: response.data.credentials || undefined,
            prc_license_number: response.data.prc_license_number || undefined,
            practice_name: response.data.practice_name || undefined,
            years_of_experience: response.data.years_of_experience || undefined,
            areas_of_expertise: response.data.areas_of_expertise || undefined,
            biography: response.data.biography || undefined,
            consultation_fee: response.data.consultation_fee || undefined,
            languages_spoken: response.data.languages_spoken || undefined,
          });
          if (response.data.professional_photo_url) {
            setPhotoPreview(
              response.data.professional_photo_url.startsWith('http')
                ? response.data.professional_photo_url
                : `${apiOrigin}${response.data.professional_photo_url}`
            );
          }
        } else {
          setError(response.error || 'Failed to load your profile.');
        }
      })
      .catch((loadError: unknown) => {
        console.error('Load doctor profile error:', loadError);
        setError('An error occurred while loading your profile.');
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccessMessage('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setEditForm({
        first_name: profile.first_name || undefined,
        middle_name: profile.middle_name || undefined,
        last_name: profile.last_name || undefined,
        contact_number: profile.contact_number || undefined,
        email: profile.email || undefined,
        specialty: profile.specialty || undefined,
        credentials: profile.credentials || undefined,
        prc_license_number: profile.prc_license_number || undefined,
        practice_name: profile.practice_name || undefined,
        years_of_experience: profile.years_of_experience || undefined,
        areas_of_expertise: profile.areas_of_expertise || undefined,
        biography: profile.biography || undefined,
        consultation_fee: profile.consultation_fee || undefined,
        languages_spoken: profile.languages_spoken || undefined,
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      // Remove email and prc_license_number from editForm
      // Email is in users table and should not be updated
      // PRC license requires dedicated process
      const { email, prc_license_number, ...profileUpdateData } = editForm;

      const response = await doctorApi.updateProfile(profileUpdateData);
      if (response.success && response.data) {
        setProfile(response.data);
        setIsEditing(false);
        setSuccessMessage('Profile updated successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Update profile error:', err);
      setError('An error occurred while updating your profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      if (response.ok && data.success) {
        setEditForm({ ...editForm, professional_photo_url: data.data.photoUrl });
        setSuccessMessage('Photo uploaded successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        URL.revokeObjectURL(previewUrl);
        setPhotoPreview(null);
        setError(data.error?.message || data.error || 'Failed to upload photo. Please try again.');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      URL.revokeObjectURL(previewUrl);
      setPhotoPreview(null);
      setError('An error occurred while uploading your photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-slate-600">Loading your profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {error || 'Profile information is unavailable.'}
      </div>
    );
  }

  const fullName = [profile.first_name, profile.middle_name, profile.last_name]
    .filter(Boolean)
    .join(' ');
  const photoUrl = profile.professional_photo_url
    ? profile.professional_photo_url.startsWith('http')
      ? profile.professional_photo_url
      : `${apiOrigin}${profile.professional_photo_url}`
    : null;
  const status = profile.approval_status || profile.profile_completion_status || 'Not available';
  const statusStyle = status === 'ACTIVE'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'REJECTED'
      ? 'bg-rose-50 text-rose-700'
      : 'bg-amber-50 text-amber-700';

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div role="alert" className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative">
              {photoPreview ? (
                <img
                  src={photoPreview.startsWith('http') || photoPreview.startsWith('blob:')
                    ? photoPreview
                    : `${apiOrigin}${photoPreview}`}
                  alt={`Professional photo of ${fullName}`}
                  className="h-32 w-32 rounded-2xl border-4 border-blue-100 object-cover shadow-md"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-3xl font-bold text-blue-700 shadow-md">
                  {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
                </div>
              )}
              {isEditing && (
                <label className="absolute bottom-0 right-0 w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors shadow-lg">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  <input
                    type="file"
                    accept="image/png"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
              <p className="mt-1 text-slate-600">{profile.specialty || 'Specialty not provided'}</p>
              <span className={`mt-3 inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${statusStyle}`}>
                {status.replaceAll('_', ' ')}
              </span>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={handleEdit}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105"
            >
              Edit Profile
            </button>
          )}
        </div>
      </section>

      {profile.approval_status === 'REJECTED' && profile.rejection_reason && (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="font-semibold text-rose-800">Profile needs attention</h2>
          <p className="mt-1 text-sm text-rose-700">{profile.rejection_reason}</p>
          {!isEditing && (
            <button
              type="button"
              onClick={handleEdit}
              className="mt-3 text-sm font-semibold text-rose-800 underline"
            >
              Update profile
            </button>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">person</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Personal Information</h2>
          </div>
          <dl className="space-y-1">
            <Detail label="First Name" value={profile.first_name}>
              {isEditing && (
                <input
                  type="text"
                  value={editForm.first_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition-all"
                  placeholder="Enter first name"
                />
              )}
            </Detail>
            <Detail label="Middle Name" value={profile.middle_name}>
              {isEditing && (
                <input
                  type="text"
                  value={editForm.middle_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition-all"
                  placeholder="Enter middle name (optional)"
                />
              )}
            </Detail>
            <Detail label="Last Name" value={profile.last_name}>
              {isEditing && (
                <input
                  type="text"
                  value={editForm.last_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition-all"
                  placeholder="Enter last name"
                />
              )}
            </Detail>
            <Detail
              label="Email"
              value={profile.email}
              disabled={true}
            />
            <Detail label="Contact Number" value={profile.contact_number}>
              {isEditing && (
                <input
                  type="tel"
                  value={editForm.contact_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition-all"
                  placeholder="Enter contact number"
                />
              )}
            </Detail>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-[20px]">medical_services</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">Professional Information</h2>
          </div>
          <dl className="space-y-1">
            <Detail label="Specialty" value={profile.specialty}>
              {isEditing && (
                <SearchableSelect
                  options={specialtyOptions}
                  value={editForm.specialty || ''}
                  onChange={(value) => setEditForm({ ...editForm, specialty: value })}
                  placeholder="Select specialty"
                />
              )}
            </Detail>
            <Detail label="Credentials" value={profile.credentials}>
              {isEditing && (
                <SearchableSelect
                  options={credentialsOptions}
                  value={editForm.credentials || ''}
                  onChange={(value) => setEditForm({ ...editForm, credentials: value })}
                  placeholder="Select credentials"
                />
              )}
            </Detail>
            <Detail
              label="PRC License Number"
              value={profile.prc_license_number}
              disabled={true}
            />
            <Detail label="Clinic / Practice Name" value={profile.practice_name}>
              {isEditing && (
                <SearchableSelect
                  options={cebuFacilityOptions}
                  value={editForm.practice_name || ''}
                  onChange={(value) => setEditForm({ ...editForm, practice_name: value })}
                  placeholder="Select hospital/clinic"
                />
              )}
            </Detail>
            <Detail label="Years of Experience" value={profile.years_of_experience}>
              {isEditing && (
                <input
                  type="number"
                  min="0"
                  value={editForm.years_of_experience || ''}
                  onChange={(e) => setEditForm({ ...editForm, years_of_experience: e.target.value ? parseInt(e.target.value) : undefined })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition-all"
                  placeholder="Enter years of experience"
                />
              )}
            </Detail>
            <Detail label="Consultation Fee" value={profile.consultation_fee == null ? null : `₱${profile.consultation_fee}`}>
              {isEditing && (
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.consultation_fee || ''}
                  onChange={(e) => setEditForm({ ...editForm, consultation_fee: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 transition-all"
                  placeholder="Enter consultation fee"
                />
              )}
            </Detail>
            <Detail label="Areas of Expertise" value={profile.areas_of_expertise}>
              {isEditing && (
                <SearchableMultiSelect
                  options={expertiseOptions}
                  value={editForm.areas_of_expertise ? editForm.areas_of_expertise.split(',').filter(Boolean) : []}
                  onChange={(value) => setEditForm({ ...editForm, areas_of_expertise: value.join(',') })}
                  placeholder="Select areas of expertise"
                />
              )}
            </Detail>
            <Detail label="Languages Spoken" value={profile.languages_spoken}>
              {isEditing && (
                <SearchableMultiSelect
                  options={languageOptions}
                  value={editForm.languages_spoken ? editForm.languages_spoken.split(',').filter(Boolean) : []}
                  onChange={(value) => setEditForm({ ...editForm, languages_spoken: value.join(',') })}
                  placeholder="Select languages"
                />
              )}
            </Detail>
          </dl>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-blue-600 text-[20px]">description</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Biography</h2>
        </div>
        {isEditing ? (
          <textarea
            defaultValue={profile.biography || ''}
            onChange={(e) => setEditForm({ ...editForm, biography: e.target.value })}
            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 min-h-[150px] transition-all resize-none"
            placeholder="Enter your biography..."
          />
        ) : (
          <p className="whitespace-pre-wrap text-base leading-7 text-slate-600">
            {profile.biography || 'Not provided'}
          </p>
        )}
      </section>

      {isEditing && (
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 px-6 py-3 border-2 border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-semibold transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold shadow-md transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
