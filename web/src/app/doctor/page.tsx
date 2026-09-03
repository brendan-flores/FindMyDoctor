export default function DoctorDashboard() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Doctor Dashboard
        </h1>
        <p className="text-center mb-12 text-gray-600">
          Welcome to the doctor dashboard. Manage your appointments, schedule, patients, and prescriptions.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Appointments</h2>
            <p className="text-gray-600">View and manage your upcoming and past appointments</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Schedule</h2>
            <p className="text-gray-600">Manage your working hours, availability, and daily capacity</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Patients</h2>
            <p className="text-gray-600">View your patient list and medical history</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Prescriptions</h2>
            <p className="text-gray-600">Create and manage patient prescriptions</p>
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
