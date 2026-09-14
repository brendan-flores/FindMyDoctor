'use client';

import { useState } from 'react';

export default function AdminSettings() {
  const [activeSection, setActiveSection] = useState('profile');

  const settingsSections = [
    { id: 'profile', label: 'Profile Settings', icon: 'account_circle' },
    { id: 'security', label: 'Security', icon: 'security' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'system', label: 'System Settings', icon: 'settings' },
  ];

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1b5eb8] shrink-0">
            <span className="material-symbols-outlined text-[26px]">tune</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage your admin account and system preferences</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <nav className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    activeSection === section.id
                      ? 'bg-[#1b5eb8] text-white shadow-sm shadow-blue-600/20'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{section.icon}</span>
                  <span>{section.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-900">Profile Settings</h2>
                <p className="text-sm text-slate-500">Update your admin profile information</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      defaultValue="Eleanor Vance"
                      className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      defaultValue="admin@fido.ph"
                      className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
                    <input
                      type="text"
                      defaultValue="Super Admin"
                      disabled
                      className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-400 bg-slate-50 cursor-not-allowed"
                    />
                  </div>

                  <div className="pt-4">
                    <button className="px-4 py-2 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors">
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-900">Security Settings</h2>
                <p className="text-sm text-slate-500">Manage your account security preferences</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Current Password</label>
                    <input
                      type="password"
                      placeholder="Enter current password"
                      className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      className="w-full h-10 px-4 text-sm border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8]"
                    />
                  </div>

                  <div className="pt-4">
                    <button className="px-4 py-2 text-sm font-semibold text-white bg-[#1b5eb8] hover:bg-[#14468f] rounded-lg transition-colors">
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-900">Notification Settings</h2>
                <p className="text-sm text-slate-500">Configure your notification preferences</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Email Notifications</div>
                      <div className="text-xs text-slate-500">Receive email updates for important events</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#1b5eb8]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b5eb8]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">New User Registrations</div>
                      <div className="text-xs text-slate-500">Get notified when new users register</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#1b5eb8]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b5eb8]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">Doctor Approvals</div>
                      <div className="text-xs text-slate-500">Get notified when doctors await approval</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#1b5eb8]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b5eb8]"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">System Alerts</div>
                      <div className="text-xs text-slate-500">Receive critical system alerts</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#1b5eb8]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1b5eb8]"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'system' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-slate-900">System Settings</h2>
                <p className="text-sm text-slate-500">Configure system-wide settings</p>

                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 mb-1">API Version</div>
                    <div className="text-xs text-slate-500">v1.0.0</div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Database Status</div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs text-slate-500">Connected</span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="text-sm font-semibold text-slate-700 mb-1">Environment</div>
                    <div className="text-xs text-slate-500">Development</div>
                  </div>

                  <div className="pt-4">
                    <button className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
                      View System Logs
                    </button>
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