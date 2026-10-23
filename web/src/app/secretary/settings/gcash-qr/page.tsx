'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';
import Toast from '@/components/ui/Toast';

interface Doctor {
  id: string;
  first_name: string;
  last_name: string;
}

export default function GcashQrManagement() {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [gcashQrUrl, setGcashQrUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated - prefer role-scoped HttpOnly cookies, fall back to localStorage
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
      }
      return null;
    };

    // Try role-scoped cookie first, then fallback to global cookie
    const cookieToken = getCookie('secretary_accessToken') || getCookie('accessToken');
    const token = cookieToken || localStorage.getItem('secretary_token') || localStorage.getItem('token');
    if (!token) {
      router.push('/secretary-login');
      return;
    }

    apiClient.setToken(token);
    fetchDoctorInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const fetchDoctorInfo = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/secretaries/me');
      if (response.success && response.data) {
        const secretaryData = response.data as any;

        if (!secretaryData.doctor_id) {
          setError('You are not assigned to a doctor. Please contact your administrator.');
          setIsLoading(false);
          return;
        }

        // Fetch doctor details from the secretary's assigned doctor
        const doctorResponse = await apiClient.get(`/doctors/${secretaryData.doctor_id}`);
        if (doctorResponse.success && doctorResponse.data) {
          const doctorData = doctorResponse.data as Doctor;
          setDoctor(doctorData);
          fetchGcashQr(doctorData.id);
        } else {
          setError('Failed to load doctor details');
        }
      } else {
        setError('Failed to load secretary information');
      }
    } catch (err) {
      console.error('Error fetching doctor info:', err);
      setError('Failed to load doctor information');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGcashQr = async (doctorId: string) => {
    try {
      const response = await apiClient.get(`/gcash-qr/doctor/${doctorId}`);
      if (response.success && response.data) {
        const data = response.data as { gcashQrUrl: string | null };
        setGcashQrUrl(data.gcashQrUrl);
      }
    } catch (err) {
      console.error('Error fetching GCash QR:', err);
      // QR code might not be set yet, that's okay
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only PNG and JPEG files are allowed');
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size exceeds 5MB limit');
        return;
      }

      setSelectedFile(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    if (!doctor) {
      setError('Doctor information not loaded. Please refresh the page.');
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('qrCode', selectedFile);

      const response = await apiClient.post(`/gcash-qr/doctor/${doctor.id}/upload`, formData, {
        isFormData: true,
      });

      if (response.success && response.data) {
        const data = response.data as { gcashQrUrl: string };
        setGcashQrUrl(data.gcashQrUrl);
        setSuccess('GCash QR code uploaded successfully');
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        setError(response.error || 'Failed to upload QR code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!doctor || !gcashQrUrl) {
      return;
    }

    if (!confirm('Are you sure you want to delete the GCash QR code?')) {
      return;
    }

    setIsDeleting(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiClient.delete(`/gcash-qr/doctor/${doctor.id}`);

      if (response.success) {
        setGcashQrUrl(null);
        setSuccess('GCash QR code deleted successfully');
      } else {
        setError(response.error || 'Failed to delete QR code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A62CD] mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F3F5F9]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.push('/secretary/settings')}
            className="inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-[#1A62CD] hover:text-[#1550A8] hover:bg-blue-50 px-2 py-1 -ml-2 mb-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A62CD]/40"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Settings
          </button>
          <h1 className="text-3xl font-bold text-slate-900">GCash QR Management</h1>
          <p className="text-slate-600 mt-2">
            Manage the GCash QR code for {doctor?.first_name} {doctor?.last_name}
          </p>
        </div>

        {/* Toast Notification */}
        {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}
        {error && <Toast message={error} type="error" onClose={() => setError('')} />}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Current GCash QR Code</h2>

          {gcashQrUrl ? (
            <div className="space-y-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <img
                  src={gcashQrUrl}
                  alt="GCash QR Code"
                  className="max-w-xs mx-auto"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete QR Code'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-lg border border-slate-200">
              <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">qr_code_2</span>
              <p className="text-slate-600">No GCash QR code has been uploaded yet</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Upload New QR Code</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select QR Code Image
              </label>
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                onChange={handleFileSelect}
                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-purple-50 file:text-purple-700
                  hover:file:bg-purple-100
                  cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-2">
                Accepted formats: PNG, JPEG. Maximum file size: 5MB
              </p>
            </div>

            {previewUrl && (
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                <p className="text-sm font-medium text-slate-700 mb-2">Preview:</p>
                <img
                  src={previewUrl}
                  alt="QR Code Preview"
                  className="max-w-xs mx-auto"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setError('');
                }}
                disabled={!selectedFile || isUploading}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !doctor || isUploading}
                className="px-4 py-2 bg-[#1A62CD] text-white rounded-lg hover:bg-[#1550A8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? 'Uploading...' : 'Upload QR Code'}
              </button>
            </div>
            {!doctor && (
              <p className="text-xs text-rose-600 mt-2">
                Doctor information not loaded. Please refresh the page.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">About GCash QR Codes</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>The QR code displayed here will be shown to patients in the mobile app</li>
            <li>Patients can scan this QR code to make GCash payments</li>
            <li>You can replace the QR code at any time by uploading a new one</li>
            <li>Payment verification is handled separately in the Payments page</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
