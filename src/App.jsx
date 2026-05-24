import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, Settings2 } from 'lucide-react';
import { AttendanceProvider } from './store/useAttendanceStore';
import AttendancePage from './pages/AttendancePage';
import ManagementPage from './pages/ManagementPage';
import './index.css';

export default function App() {
  return (
    <AttendanceProvider>
      <AppContent />
    </AttendanceProvider>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isAttendance = location.pathname.startsWith('/yoklama');

  return (
    <div className="flex flex-col h-dvh w-full max-w-lg mx-auto relative overflow-hidden bg-slate-950">
      
      {/* ── Unified View Toggle Button (Top-Middle) ── */}
      <div className="absolute top-[calc(env(safe-area-inset-top,0px)+8px)] left-1/2 -translate-x-1/2 z-[100]">
        <button
          onClick={() => navigate(isAttendance ? '/yonetim' : '/yoklama')}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/90 backdrop-blur-md border border-slate-700/50 text-slate-300 transition-all shadow-lg"
        >
          {isAttendance ? (
            <>
              <Settings2 size={14} className="text-slate-400" />
              <span className="text-[11px] font-semibold tracking-wide uppercase">Yönetim Paneli</span>
            </>
          ) : (
            <>
              <ClipboardList size={14} className="text-slate-400" />
              <span className="text-[11px] font-semibold tracking-wide uppercase">Yoklama Ekranı</span>
            </>
          )}
        </button>
      </div>

      {/* ── Main content area ── */}
      <main className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <Routes>
            <Route path="/"           element={<Navigate to="/yoklama" replace />} />
            <Route path="/yoklama"    element={<AttendancePage />} />
            <Route path="/yonetim"    element={<ManagementPage />} />
          </Routes>
        </main>
    </div>
  );
}
