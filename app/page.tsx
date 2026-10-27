"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Shield } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (user.role === "ADMIN") {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/staff/dashboard");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="flex flex-col items-center text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-xl shadow-emerald-600/20 mb-4 animate-bounce">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          DVLA Attendance System
        </h1>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          Initializing portal session and permissions...
        </p>
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
      </div>
    </div>
  );
}
