import React, { useState, useEffect } from 'react';
import { BookOpen, LogOut, User, GraduationCap, School, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { AppUser } from '../types';
import { subscribeToOfflineStatus, getUserProfile } from '../dbUtils';

interface NavbarProps {
  user: AppUser | null;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToOfflineStatus((status) => {
      setIsOffline(status);
    });
    return () => unsubscribe();
  }, []);

  const handleSync = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        console.log("Cloud sync restored successfully!");
      }
    } catch (err) {
      console.warn("Manual cloud sync check failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0f865f] shadow-sm border-b border-[#0c6b4c]">
      <div className="mx-auto flex h-13 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        
        {/* Left Section: Logo & Logout */}
        <div className="flex items-center space-x-2.5 sm:space-x-4 shrink-0">
          {/* Brand Logo */}
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-white text-[#0f865f] shadow-sm shrink-0">
              <GraduationCap className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
          </div>

          {/* Logout Button (Red Pill like screenshot) */}
          {user && (
            <button
              id="logout-btn"
              onClick={onLogout}
              className="flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 sm:px-4 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-colors shadow-sm"
              title="লগআউট"
            >
              লগআউট
            </button>
          )}
        </div>

        {/* Portal Target for Desktop Navigation (Rendered from Dashboards) */}
        <div id="desktop-nav-portal" className="hidden md:flex flex-1 justify-center px-4"></div>

        {/* Center/Right Section containing Offline/Status & User Profile */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Dynamic Connection Status Indicator */}
          {isOffline ? (
            <button
              id="sync-connection-btn"
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex items-center space-x-1 sm:space-x-1.5 rounded-full bg-rose-500/20 border border-rose-400/30 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-bold text-white shadow-sm transition-all hover:bg-rose-500/30 active:scale-95 cursor-pointer ${isSyncing ? '' : 'animate-pulse ring-2 ring-rose-400/20'}`}
              title="Click to reconnect and sync with Cloud"
            >
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                {isSyncing ? (
                  <RefreshCw className="h-1.5 w-1.5 sm:h-2 sm:w-2 text-white animate-spin" />
                ) : (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-rose-400"></span>
                  </>
                )}
              </span>
              {isSyncing ? (
                <RefreshCw className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-white shrink-0 animate-spin" />
              ) : (
                <WifiOff className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-white shrink-0" />
              )}
              <span className="hidden min-[450px]:inline-block uppercase tracking-wider">{isSyncing ? 'Syncing...' : 'Offline'}</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center space-x-1.5 rounded-full bg-[#0c6b4c]/50 border border-[#14a375] px-3 py-1.5 text-[11px] font-bold text-white" title="Connected live to Google Cloud Firestore">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <Wifi className="h-3.5 w-3.5 text-white" />
              <span>Cloud Sync</span>
            </div>
          )}

          {/* User Info (Right-aligned in typical view) */}
          {user && (
            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
              <div className="hidden min-[480px]:block text-right">
                <p className="max-w-[120px] truncate text-xs font-black text-white leading-tight">
                  {user.name.split(' ')[0]}
                </p>
                <span className="inline-block rounded px-1.5 py-0.5 mt-0.5 text-[9px] font-bold uppercase tracking-widest bg-[#0c6b4c] text-teal-100">
                  {user.role === 'teacher' ? 'Teacher' : 'Student'}
                </span>
              </div>
              <div className="flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white text-[#0f865f] shadow-sm shrink-0">
                {user.role === 'teacher' ? (
                  <School className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                ) : (
                  <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
