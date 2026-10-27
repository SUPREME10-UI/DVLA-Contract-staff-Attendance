"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Loading DVLA Attendance Portal...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // AuthProvider will redirect to /login
  }

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-68 transition-all duration-300">
        <Navbar onMenuClick={() => setSidebarOpen(true)} title={title} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
