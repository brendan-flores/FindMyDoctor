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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-4">
            <nav className="space-y-1">
              {settingsSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg font-medium text-sm transition-all ${
                    activeSection === section.id
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                      : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
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
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-6">
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-neutral-900">Profile Settings</h2>
                <p className="text-sm text-neutral-500">Update your admin profile information</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      defaultValue="Eleanor Vance"
                      className="w-full h-10 px-4 text-sm border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      defaultValue="admin@fido.ph"
                      className="w-full h-10 px-4 text-sm border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Role</label>
                    <input
                      type="text"
                      defaultValue="Super Admin"
                      disabled
                      className="w-full h-10 px-4 text-sm border border-neutral-200 rounded-lg text-neutral-400 bg-neutral-50 cursor-not-allowed"
                    />
                  </div>

                  <div className="pt-4">
                    <button className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-neutral-900">Security Settings</h2>
                <p className="text-sm text-neutral-500">Manage your account security preferences</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Current Password</label>
                    <input
                      type="password"
                      placeholder="Enter current password"
                      className="w-full h-10 px-4 text-sm border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">New Password</label>
                    <input
                      type="password"
                      placeholder="Enter new password"
                      className="w-full h-10 px-4 text-sm border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      className="w-full h-10 px-4 text-sm border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600"
                    />
                  </div>

                  <div className="pt-4">
                    <button className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-neutral-900">Notification Settings</h2>
                <p className="text-sm text-neutral-500">Configure your notification preferences</p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                    <div>
                      <div className="text-sm font-semibold text-neutral-700">Email Notifications</div>
                      <div className="text-xs text-neutral-500">Receive email updates for important events</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-600/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                    <div>
                      <div className="text-sm font-semibold text-neutral-700">New User Registrations</div>
                      <div className="text-xs text-neutral-500">Get notified when new users register</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-600/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-neutral-100">
                    <div>
                      <div className="text-sm font-semibold text-neutral-700">Doctor Approvals</div>
                      <div className="text-xs text-neutral-500">Get notified when doctors await approval</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-600/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-semibold text-neutral-700">System Alerts</div>
                      <div className="text-xs text-neutral-500">Receive critical system alerts</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-600/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'system' && (
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-neutral-900">System Settings</h2>
                <p className="text-sm text-neutral-500">Configure system-wide settings</p>

                <div className="space-y-4">
                  <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                    <div className="text-sm font-semibold text-neutral-700 mb-1">API Version</div>
                    <div className="text-xs text-neutral-500">v1.0.0</div>
                  </div>

                  <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                    <div className="text-sm font-semibold text-neutral-700 mb-1">Database Status</div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-success-500"></span>
                      <span className="text-xs text-neutral-500">Connected</span>
                    </div>
                  </div>

                  <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                    <div className="text-sm font-semibold text-neutral-700 mb-1">Environment</div>
                    <div className="text-xs text-neutral-500">Development</div>
                  </div>

                  <div className="pt-4">
                    <button className="px-4 py-2 text-sm font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors">
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