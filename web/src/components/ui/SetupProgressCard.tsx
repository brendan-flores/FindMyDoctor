'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DoctorProfile } from '@/lib/api/doctorApi';

interface SetupProgressCardProps {
  profile: DoctorProfile;
  schedules: any[];
}

interface SetupStep {
  label: string;
  completed: boolean;
  path: string;
}

export default function SetupProgressCard({ profile, schedules }: SetupProgressCardProps) {
  const router = useRouter();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [steps, setSteps] = useState<SetupStep[]>([
    { label: 'Account Registration & Email Verification', completed: false, path: '/doctor/profile' },
    { label: 'Complete Professional Profile', completed: false, path: '/doctor/profile' },
    { label: 'Admin Approval', completed: false, path: '/doctor/profile' },
    { label: 'Set Availability & Schedule', completed: false, path: '/doctor/schedule' },
  ]);
  const panelRef = useRef<HTMLDivElement>(null);

  // Check if any profile fields are missing
  const hasMissingProfileFields = () => {
    const allFields = [
      profile.specialty,
      profile.credentials,
      profile.prc_license_number,
      profile.practice_name,
      profile.years_of_experience,
      profile.areas_of_expertise,
      profile.biography,
      profile.consultation_fee,
      profile.languages_spoken,
      profile.professional_photo_url,
    ];

    return allFields.some(field => {
      if (field === null || field === undefined) return true;
      if (typeof field === 'string' && field.trim() === '') return true;
      return false;
    });
  };

  // Calculate setup progress
  useEffect(() => {
    const newSteps: SetupStep[] = [
      {
        label: 'Account Registration & Email Verification',
        completed: !!profile.email_verified,
        path: '/doctor/profile',
      },
      {
        label: 'Complete Professional Profile',
        completed: !hasMissingProfileFields() && (profile.profile_completion_status === 'COMPLETE' || profile.profile_completion_status === 'SUBMITTED'),
        path: '/doctor/profile',
      },
      {
        label: 'Admin Approval',
        completed: profile.approval_status === 'ACTIVE',
        path: '/doctor/profile',
      },
      {
        label: 'Set Availability & Schedule',
        completed: schedules.length > 0,
        path: '/doctor/schedule',
      },
    ];
    setSteps(newSteps);
  }, [profile, schedules]);

  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const progressPercentage = (completedCount / totalCount) * 100;

  // Determine if setup is complete
  const isSetupComplete = completedCount === totalCount;

  // Auto-hide if setup is complete
  if (isSetupComplete) {
    return null;
  }

  // Get missing profile fields
  const getMissingProfileFields = () => {
    const fieldLabels = [
      { field: profile.specialty, label: 'Specialty' },
      { field: profile.credentials, label: 'Credentials' },
      { field: profile.prc_license_number, label: 'PRC License Number' },
      { field: profile.practice_name, label: 'Hospital/Clinic' },
      { field: profile.years_of_experience, label: 'Years of Experience' },
      { field: profile.areas_of_expertise, label: 'Areas of Expertise' },
      { field: profile.biography, label: 'Biography' },
      { field: profile.consultation_fee, label: 'Consultation Fee' },
      { field: profile.languages_spoken, label: 'Languages Spoken' },
      { field: profile.professional_photo_url, label: 'Professional Photo' },
    ];

    return fieldLabels.filter(f => {
      if (f.field === null || f.field === undefined) return true;
      if (typeof f.field === 'string' && f.field.trim() === '') return true;
      return false;
    }).map(f => f.label);
  };

  const handleNavigate = (path: string) => {
    setIsPanelOpen(false);
    router.push(path);
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsPanelOpen(false);
      }
    };

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPanelOpen]);

  return (
    <>
      {/* Compact Trigger in Sidebar */}
      <div className="w-full px-3 py-3">
        <button
          onClick={() => setIsPanelOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all shadow-sm group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <svg className="w-8 h-8 transform -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="#e2e8f0"
                  strokeWidth="3"
                  fill="none"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="url(#progressGradient)"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 14}`}
                  strokeDashoffset={`${2 * Math.PI * 14 * (1 - progressPercentage / 100)}`}
                  className="transition-all duration-300"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
                {completedCount}
              </span>
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">Setup Progress</p>
              <p className="text-xs text-slate-500">{completedCount} of {totalCount} steps</p>
            </div>
          </div>
          <span className="material-symbols-outlined text-slate-400 group-hover:text-blue-600 transition-colors">chevron_right</span>
        </button>
      </div>

      {/* Floating Panel */}
      {isPanelOpen && (
        <div
          ref={panelRef}
          className="fixed left-64 top-20 w-[360px] max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-y-auto"
          style={{ maxHeight: '70vh' }}
        >
          <div className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800">Complete your doctor setup</h3>
                <p className="text-sm text-slate-500 mt-1">{completedCount} of {totalCount} steps completed</p>
              </div>
              <button
                onClick={() => setIsPanelOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Close setup panel"
              >
                <span className="material-symbols-outlined text-slate-600">close</span>
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* Steps list */}
            <div className="space-y-1.5 mb-4">
              {steps.map((step, index) => (
                <div
                  key={index}
                  onClick={() => handleNavigate(step.path)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.completed
                      ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600'
                  }`}>
                    {step.completed ? (
                      <span className="material-symbols-outlined text-[14px]">check</span>
                    ) : (
                      <span className="text-xs font-semibold">{index + 1}</span>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${step.completed ? 'text-slate-500 line-through' : 'text-slate-800 group-hover:text-blue-600 transition-colors'}`}>
                    {step.label}
                  </span>
                  {!step.completed && (
                    <span className="material-symbols-outlined text-[16px] text-slate-400 ml-auto opacity-0 group-hover:opacity-100 group-hover:text-blue-600 transition-all">
                      arrow_forward
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Missing profile fields indicator */}
            {!steps[1].completed && steps[0].completed && (
              <div className="mb-4 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                <div
                  onClick={() => handleNavigate('/doctor/profile')}
                  className="flex items-center justify-between cursor-pointer mb-2 group"
                >
                  <p className="text-xs font-bold text-amber-900 group-hover:text-blue-700 group-hover:underline">
                    Professional information incomplete
                  </p>
                  <span className="text-xs font-semibold text-blue-600 group-hover:underline flex items-center gap-0.5">
                    Complete <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </span>
                </div>
                <p className="text-xs text-amber-800 font-medium mb-1.5">Missing fields:</p>
                <ul className="text-xs space-y-1">
                  {getMissingProfileFields().map((field, index) => (
                    <li
                      key={index}
                      onClick={() => handleNavigate('/doctor/profile')}
                      className="cursor-pointer hover:bg-amber-100/60 p-1 rounded-md transition-colors flex items-center justify-between text-amber-900 font-medium group"
                    >
                      <span className="group-hover:text-blue-700 group-hover:underline">• {field}</span>
                      <span className="text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 font-semibold transition-opacity">Edit &rarr;</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing schedule indicator */}
            {!steps[3].completed && steps[2].completed && (
              <div
                onClick={() => handleNavigate('/doctor/schedule')}
                className="mb-4 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl cursor-pointer hover:border-amber-300 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-amber-900 group-hover:text-blue-700 group-hover:underline">
                    Availability & Schedule incomplete
                  </p>
                  <span className="text-xs font-semibold text-blue-600 group-hover:underline flex items-center gap-0.5">
                    Configure <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </span>
                </div>
                <p className="text-xs text-amber-700">Missing: No schedules configured</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

