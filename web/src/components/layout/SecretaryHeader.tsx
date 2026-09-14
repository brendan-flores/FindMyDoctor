'use client';

interface SecretaryHeaderProps {
  userName?: string;
  userRole?: string;
}

export default function SecretaryHeader({ userName = 'Secretary', userRole = 'Secretary' }: SecretaryHeaderProps) {
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
            Secretary Portal
          </span>
          <span className="text-slate-300">|</span>
          <div className="text-sm font-semibold text-slate-800 truncate">
            FindMyDoctor Healthcare Network
          </div>
        </div>
      </div>

      {/* Right: Date & Profile Controls */}
      <div className="flex items-center gap-5">
        {/* Date / Shift Tag */}
        <div className="hidden xl:flex flex-col text-right leading-tight">
          <span className="text-xs font-semibold text-slate-700">{formattedDate}</span>
          <span className="text-[11px] font-mono text-slate-400">{formattedTime}</span>
        </div>

        {/* Notification Bell */}
        <button className="relative w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
        </button>

        {/* Secretary Avatar */}
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