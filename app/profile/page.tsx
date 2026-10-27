"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import {
  User,
  Shield,
  Key,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  Lock,
  Loader2
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  useEffect(() => {
    if (user && user.role === "STAFF") {
      router.replace("/staff/dashboard");
    }
  }, [user, router]);

  if (user?.role === "STAFF") {
    return null;
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toastError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      toastError("Password must contain at least 6 characters.");
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "Password updated successfully!", "Success");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toastError(data.error || "Failed to update password.");
      }
    } catch {
      toastError("Error updating password.");
    } finally {
      setIsChangingPass(false);
    }
  };

  return (
    <AppLayout title="My User Profile">
      <div className="space-y-6 max-w-4xl">
        {/* Profile Info Header */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white font-bold text-2xl flex items-center justify-center uppercase shadow-md shadow-emerald-600/20 shrink-0">
            {user?.name?.charAt(0) || "U"}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                {user?.name}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                {user?.role}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user?.email}
              </span>
              {user?.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {user.phone}
                </span>
              )}
              {user?.staffId && (
                <span className="flex items-center gap-1.5 font-mono">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  Staff ID: <strong>{user.staffId}</strong>
                </span>
              )}
              {user?.departmentName && (
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-teal-600" />
                  {user.departmentName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Change Password Form (Requirement 3) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
            <Key className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Security & Password Management
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md text-xs">
            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                placeholder="Enter existing password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                New Security Password
              </label>
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isChangingPass}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isChangingPass ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                Update Security Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
