'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';

interface SecretaryProfile {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  contact_number: string;
  doctor_first_name: string;
  doctor_last_name: string;
  practice_name: string;
}

export default function SecretaryProfile() {
  const [profile, setProfile] = useState<SecretaryProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const router = useRouter();

  const fetchProfile = async () => {
    try {
      const response = await apiClient.get('/users/me');
      if (response.success && response.data) {
        const data = response.data as SecretaryProfile;
        setProfile(data);
        // Initialize form with current values
        setFirstName(data.first_name || '');
        setMiddleName(data.middle_name || '');
        setLastName(data.last_name || '');
        setContactNumber(data.contact_number || '');
      }
    } catch (err) {
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    setSuccess('');
    // Reset form to current profile values
    if (profile) {
      setFirstName(profile.first_name || '');
      setMiddleName(profile.middle_name || '');
      setLastName(profile.last_name || '');
      setContactNumber(profile.contact_number || '');
    } else {
      // If no profile data, reset to empty
      setFirstName('');
      setMiddleName('');
      setLastName('');
      setContactNumber('');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    setSuccess('');

    // Client-side validation
    if (!firstName || !lastName || !contactNumber) {
      setError('First name, last name, and contact number are required');
      setIsSaving(false);
      return;
    }

    if (firstName.trim().length === 0 || firstName.trim().length > 100) {
      setError('First name must be 1-100 characters');
      setIsSaving(false);
      return;
    }

    if (middleName && middleName.trim().length > 100) {
      setError('Middle name must be maximum 100 characters');
      setIsSaving(false);
      return;
    }

    if (lastName.trim().length === 0 || lastName.trim().length > 100) {
      setError('Last name must be 1-100 characters');
      setIsSaving(false);
      return;
    }

    if (contactNumber.trim().length === 0 || contactNumber.trim().length > 20) {
      setError('Contact number must be 1-20 characters');
      setIsSaving(false);
      return;
    }

    try {
      const response = await apiClient.put('/secretaries/me', {
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        lastName: lastName.trim(),
        contactNumber: contactNumber.trim(),
      });

      if (response.success) {
        setSuccess('Profile updated successfully');
        setIsEditing(false);
        // Re-fetch profile to get updated values
        await fetchProfile();
      } else {
        setError(response.error || 'Profile update failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
        <div className="text-slate-600">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
        <div className="text-slate-600">Failed to load profile</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1b5eb8] shrink-0">
            <span className="material-symbols-outlined text-[26px]">account_circle</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">My Profile</h1>
            <p className="text-xs text-slate-500 mt-0.5">View and manage your secretary profile information</p>
          </div>
        </div>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors"
          >
            Edit Profile
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm mb-6">
                {success}
              </div>
            )}

            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">Edit Personal Information</h2>
                  <p className="text-sm text-slate-500 mb-6">Update your personal details below</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="firstName" className="block text-sm font-semibold text-slate-700">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Enter your first name"
                        required
                        maxLength={100}
                        className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="middleName" className="block text-sm font-semibold text-slate-700">
                        Middle Name
                      </label>
                      <input
                        id="middleName"
                        type="text"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="Enter your middle name"
                        maxLength={100}
                        className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="lastName" className="block text-sm font-semibold text-slate-700">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Enter your last name"
                        required
                        maxLength={100}
                        className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="contactNumber" className="block text-sm font-semibold text-slate-700">
                        Contact Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="contactNumber"
                        type="tel"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="09123456789"
                        required
                        maxLength={20}
                        className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                      />
                      <p className="text-xs text-slate-500">Philippine mobile format: 09123456789</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-8">
                {/* Personal Information */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">Personal Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">First Name</label>
                      <div className="text-sm font-medium text-slate-900">{profile.first_name || '-'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Middle Name</label>
                      <div className="text-sm font-medium text-slate-900">{profile.middle_name || '-'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Last Name</label>
                      <div className="text-sm font-medium text-slate-900">{profile.last_name || '-'}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Contact Number</label>
                      <div className="text-sm font-medium text-slate-900">{profile.contact_number || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* Account Information */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">Account Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email</label>
                      <div className="text-sm font-medium text-slate-900">{profile.email}</div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Role</label>
                      <div className="text-sm font-medium text-slate-900">{profile.role}</div>
                    </div>
                  </div>
                </div>

                {/* Doctor/Practice Information */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">Doctor / Practice Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Doctor Name</label>
                      <div className="text-sm font-medium text-slate-900">
                        {profile.doctor_first_name && profile.doctor_last_name
                          ? `${profile.doctor_first_name} ${profile.doctor_last_name}`
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Practice Name</label>
                      <div className="text-sm font-medium text-slate-900">{profile.practice_name || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
