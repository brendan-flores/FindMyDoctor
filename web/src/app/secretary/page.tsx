export default function SecretaryDashboard() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Secretary Dashboard
        </h1>
        <p className="text-center mb-12 text-gray-600">
          Welcome to the secretary dashboard. Manage daily queue, walk-ins, payments, and messaging.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Daily Queue</h2>
            <p className="text-gray-600">Manage the daily patient queue and call patients</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Appointments</h2>
            <p className="text-gray-600">View and manage clinic appointments</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Conversations</h2>
            <p className="text-gray-600">Chat with patients and manage communications</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Walk-in Registration</h2>
            <p className="text-gray-600">Register walk-in patients and manage queue</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Payments</h2>
            <p className="text-gray-600">Verify and manage patient payments</p>
          </div>
          
          <div className="rounded-lg border border-gray-300 p-6">
            <h2 className="text-xl font-semibold mb-4">Clinic</h2>
            <p className="text-gray-600">Manage clinic information and settings</p>
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
