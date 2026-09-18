'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/apiClient';

interface Admin {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminManagement() {
  const router = useRouter();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    // Check authentication and role
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (!token || !userStr) {
      router.push('/admin/login');
      return;
    }

    const user = JSON.parse(userStr);
    setUserRole(user.role);

    // Check if user is SUPERADMIN
    if (user.role !== 'SUPERADMIN') {
      alert('Access denied. SUPERADMIN access required.');
      router.push('/admin/login');
      return;
    }

    // Set token in API client
    apiClient.setToken(token);

    fetchAdmins();
  }, [router]);

  const fetchAdmins = async () => {
    try {
      console.log('Fetching admins from:', '/admin/admins');
      const response = await apiClient.get('/admin/admins');
      console.log('Admin API response:', response);
      
      if (response.success) {
        setAdmins(response.data as Admin[]);
        console.log('Admins set:', response.data);
      } else {
        console.error('Admin API error:', response.error);
        alert(`Failed to fetch admins: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
      alert('Failed to fetch admins. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const getAdminCount = () => {
    return admins.length;
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Creating admin with email:', newAdminEmail);
    
    // Basic validation
    if (!newAdminEmail || !newAdminPassword) {
      alert('Please fill in all fields');
      return;
    }

    if (newAdminPassword.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    try {
      const response = await apiClient.post('/admin/admins', {
        email: newAdminEmail,
        password: newAdminPassword
      });

      console.log('Create admin response:', response);

      if (response.success) {
        setShowCreateModal(false);
        setNewAdminEmail('');
        setNewAdminPassword('');
        alert('Admin account created successfully!');
        await fetchAdmins(); // Refresh the list
      } else {
        alert(`Failed to create admin: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating admin:', error);
      alert('Failed to create admin account. Please try again.');
    }
  };

  const handleToggleStatus = async (adminId: string, currentStatus: boolean) => {
    try {
      const response = await apiClient.patch(`/admin/admins/${adminId}`, {
        is_active: !currentStatus
      });

      if (response.success) {
        await fetchAdmins(); // Refresh the list
      } else {
        alert(response.error || 'Failed to update admin status');
      }
    } catch (error) {
      console.error('Error toggling admin status:', error);
      alert('Failed to update admin status');
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm('Are you sure you want to delete this admin account?')) return;

    try {
      const response = await apiClient.delete(`/admin/admins/${adminId}`);

      if (response.success) {
        await fetchAdmins(); // Refresh the list
      } else {
        alert(response.error || 'Failed to delete admin account');
      }
    } catch (error) {
      console.error('Error deleting admin:', error);
      alert('Failed to delete admin account');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Management</h1>
          <p className="text-slate-600 mt-1">Manage regular administrator accounts (ADMIN role only)</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#1b5eb8] text-white rounded-lg hover:bg-[#0d3b75] transition-colors"
        >
          Add Admin
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600">Total Admins</div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{admins.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600">Active Admins</div>
          <div className="text-3xl font-bold text-green-600 mt-2">{admins.filter(admin => admin.is_active).length}</div>
        </div>
      </div>

      {/* Admin Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {admins.map((admin) => (
              <tr key={admin.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {admin.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => handleToggleStatus(admin.id, admin.is_active)}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      admin.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {admin.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                  {new Date(admin.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={() => handleDeleteAdmin(admin.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New Admin</h2>
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="•••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewAdminEmail('');
                    setNewAdminPassword('');
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1b5eb8] text-white rounded-lg hover:bg-[#0d3b75]"
                >
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}