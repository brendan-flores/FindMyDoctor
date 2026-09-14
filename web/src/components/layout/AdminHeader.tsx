'use client';

interface AdminHeaderProps {
  userName?: string;
  userRole?: string;
}

export default function AdminHeader({ userName = 'E. Vance', userRole = 'Super Admin' }: AdminHeaderProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = currentDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white border-b border-slate-200 z-20 flex items-center justify-between px-8">
      {/* Left: Badge & Hierarchy */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-[#1b5eb8] border border-blue-100">
            Admin Console
          </span>
          <span className="text-slate-300">|</span>
          <div className="text-sm font-semibold text-slate-800 truncate">
            Central Medical Healthcare Network
          </div>
          <span className="text-slate-400 text-xs hidden lg:inline">System Directory & Governance</span>
        </div>
        <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>99.98% Operational</span>
        </div>
      </div>

      {/* Right: Search, Date & Profile Controls */}
      <div className="flex items-center gap-5">
        {/* Search Input */}
        <div className="relative hidden md:block w-72">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1b5eb8]/20 focus:border-[#1b5eb8] transition-all"
            placeholder="Search physicians, clinics, NPI..."
            type="text"
          />
        </div>

        {/* Date / Shift Tag */}
        <div className="hidden xl:flex flex-col text-right leading-tight">
          <span className="text-xs font-semibold text-slate-700">{formattedDate}</span>
          <span className="text-[11px] font-mono text-slate-400">{formattedTime} • Shift A</span>
        </div>

        {/* Notification Bell */}
        <button className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
        </button>

        {/* Admin Avatar */}
        <div className="flex items-center gap-2.5 pl-1 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-[#1b5eb8] text-white flex items-center justify-center font-semibold text-xs shadow-sm">
            {getInitials(userName)}
          </div>
          <div className="hidden lg:block text-left leading-none">
            <div className="text-xs font-semibold text-slate-800">{userName}</div>
            <div className="text-[10px] text-slate-400">{userRole}</div>
          </div>
        </div>
      </div>
    </header>
  );
}