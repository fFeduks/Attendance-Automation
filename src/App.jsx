import React from 'react';
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { ClipboardList, Settings2 } from 'lucide-react';
import { AttendanceProvider } from './store/useAttendanceStore';
import AttendancePage from './pages/AttendancePage';
import ManagementPage from './pages/ManagementPage';
import './index.css';

export default function App() {
  return (
    <AttendanceProvider>
      <div className="flex flex-col h-dvh w-full max-w-lg mx-auto relative overflow-hidden">
        {/* ── Main content area ── */}
        <main className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <Routes>
            <Route path="/"           element={<Navigate to="/yoklama" replace />} />
            <Route path="/yoklama"    element={<AttendancePage />} />
            <Route path="/yonetim"    element={<ManagementPage />} />
          </Routes>
        </main>

        {/* ── Bottom Tab Navigation ── */}
        <nav
          className="flex-shrink-0 flex bg-slate-900/95 backdrop-blur-sm border-t border-slate-800"
          style={{ paddingBottom: 'var(--safe-bottom)' }}
        >
          <NavLink
            to="/yoklama"
            id="nav-yoklama"
            className={({ isActive }) =>
              `bottom-nav-item flex-1 ${isActive ? 'active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <ClipboardList
                  size={22}
                  className={isActive ? 'text-indigo-400' : 'text-slate-600'}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className={`text-xs font-medium ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
                  Yoklama
                </span>
              </>
            )}
          </NavLink>

          <NavLink
            to="/yonetim"
            id="nav-yonetim"
            className={({ isActive }) =>
              `bottom-nav-item flex-1 ${isActive ? 'active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <Settings2
                  size={22}
                  className={isActive ? 'text-indigo-400' : 'text-slate-600'}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span className={`text-xs font-medium ${isActive ? 'text-indigo-400' : 'text-slate-600'}`}>
                  Yönetim
                </span>
              </>
            )}
          </NavLink>
        </nav>
      </div>
    </AttendanceProvider>
  );
}
