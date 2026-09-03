export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold mb-8 text-center">
          FindMyDoctor Dashboard
        </h1>
        <p className="text-center mb-12 text-gray-600">
          Select your role to access the appropriate dashboard
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="/doctor"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          >
            <h2 className="mb-3 text-2xl font-semibold">
              Doctor Dashboard
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Manage appointments, schedules, patients, and prescriptions
            </p>
          </a>

          <a
            href="/secretary"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          >
            <h2 className="mb-3 text-2xl font-semibold">
              Secretary Dashboard
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Manage daily queue, walk-ins, payments, and messaging
            </p>
          </a>

          <a
            href="/admin"
            className="group rounded-lg border border-transparent px-5 py-4 transition-colors border-gray-300 hover:border-gray-500 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
          >
            <h2 className="mb-3 text-2xl font-semibold">
              Admin Dashboard
              <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                →
              </span>
            </h2>
            <p className="m-0 max-w-[30ch] text-sm opacity-50">
              Manage users, doctors, secretaries, clinics, and system settings
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}
