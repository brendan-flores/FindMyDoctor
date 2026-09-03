export default function AdminDashboard() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Admin Dashboard
        </h1>
        <p className="text-center mb-12 text-gray-600">
          Welcome to the admin dashboard. Manage users, doctors, secretaries, clinics, and system settings.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Users</h2>
            <p className="text-gray-600">Manage all user accounts and permissions</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Doctors</h2>
            <p className="text-gray-600">Manage doctor profiles, specialties, and credentials</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Secretaries</h2>
            <p className="text-gray-600">Manage secretary accounts and clinic assignments</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Clinics</h2>
            <p className="text-gray-600">Manage clinic information and operations</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Appointments</h2>
            <p className="text-gray-600">View and manage system-wide appointments</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
            <p className="text-gray-600">Manage your admin profile and settings</p>
          </div>
        </div>
        
        <div className="mt-8 text-center">
          <a href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </a>
        </div>
      </div>
    </main>
  );
}
