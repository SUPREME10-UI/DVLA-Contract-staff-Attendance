"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import {
  Settings,
  Clock,
  Building,
  Save,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings state
  const [form, setForm] = useState({
    workStartTime: "08:00",
    workEndTime: "17:00",
    lateGraceMinutes: 15,
    halfDayHours: 4.0,
    requireLocation: false,
    allowOvertime: true,
    orgName: "Driver and Vehicle Licensing Authority (DVLA)",
    orgAddress: "1 Jawahar Lal Nehru Road, Cantonments, Accra, Ghana",
    orgPhone: "+233 30 274 6760",
    orgEmail: "info@dvla.gov.gh"
  });

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const s = data.settings;
        const o = data.organization;
        setForm({
          workStartTime: s?.work_start_time || "08:00",
          workEndTime: s?.work_end_time || "17:00",
          lateGraceMinutes: s?.late_grace_minutes ?? 15,
          halfDayHours: s?.half_day_hours ?? 4.0,
          requireLocation: s?.require_location === 1,
          allowOvertime: s?.allow_overtime === 1,
          orgName: o?.name || "Driver and Vehicle Licensing Authority (DVLA)",
          orgAddress: o?.address || "Cantonments, Accra, Ghana",
          orgPhone: o?.phone || "+233 30 274 6760",
          orgEmail: o?.email || "info@dvla.gov.gh"
        });
      }
    } catch {
      toastError("Failed to fetch settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== "ADMIN") {
      toastError("Only administrators can modify system parameters.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "Attendance rules updated successfully!", "Settings Saved");
        await fetchSettings();
      } else {
        toastError(data.error || "Failed to update settings.");
      }
    } catch {
      toastError("Network error saving configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="System Settings">
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 mt-2">Loading configuration...</p>
        </div>
      </AppLayout>
    );
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <AppLayout title="System Settings & Attendance Rules">
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
            <Settings className="w-4 h-4" /> Operational Parameters
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            Attendance Rules & Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure official working shift hours, late arrival grace thresholds, and organization identity
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Working Hours & Shift Rules */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Working Shift & Punctuality Thresholds (Rule 5 & 17)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Official Shift Start Time (24h format)
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={form.workStartTime}
                  onChange={(e) => setForm({ ...form, workStartTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Expected morning arrival</span>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Official Shift End Time (24h format)
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={form.workEndTime}
                  onChange={(e) => setForm({ ...form, workEndTime: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Standard departure time</span>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Late Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  disabled={!isAdmin}
                  value={form.lateGraceMinutes}
                  onChange={(e) => setForm({ ...form, lateGraceMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Staff arriving after {form.workStartTime} + {form.lateGraceMinutes}m are marked &ldquo;LATE&rdquo;
                </span>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Half-Day Threshold (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="8"
                  required
                  disabled={!isAdmin}
                  value={form.halfDayHours}
                  onChange={(e) => setForm({ ...form, halfDayHours: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Departures before this duration are recorded as Half-Day
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={form.allowOvertime}
                  onChange={(e) => setForm({ ...form, allowOvertime: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Allow overtime duration calculation past official shift end</span>
              </label>

              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={form.requireLocation}
                  onChange={(e) => setForm({ ...form, requireLocation: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Require GPS / designated workstation verification on check-in</span>
              </label>
            </div>
          </div>

          {/* Organization Details */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Building className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Organization Information (Report Header)
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Organization Legal Name
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={form.orgName}
                  onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Physical Headquarters Address
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={form.orgAddress}
                  onChange={(e) => setForm({ ...form, orgAddress: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Official Phone Contact
                </label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={form.orgPhone}
                  onChange={(e) => setForm({ ...form, orgPhone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Inquiry / Support Email
                </label>
                <input
                  type="email"
                  required
                  disabled={!isAdmin}
                  value={form.orgEmail}
                  onChange={(e) => setForm({ ...form, orgEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Configuration Parameters
              </button>
            </div>
          )}
        </form>
      </div>
    </AppLayout>
  );
}
