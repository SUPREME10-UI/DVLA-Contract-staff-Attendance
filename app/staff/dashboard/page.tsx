"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import {
  Clock,
  CalendarCheck,
  CheckCircle2,
  AlertCircle,
  Clock4,
  MapPin,
  Calendar,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  Loader2,
  CheckCircle,
  ShieldAlert,
  Send,
  Camera
} from "lucide-react";
import Link from "next/link";
import { BiometricWebcamModal } from "@/components/BiometricWebcamModal";

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [locationNote, setLocationNote] = useState("DVLA Head Office Terminal, Cantonments");
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const todayIso = new Date().toISOString().substring(0, 10);
      const res = await fetch(`/api/dashboard?date=${todayIso}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      toastError("Failed to load attendance dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleAttendanceAction = async (action: "CHECK_IN" | "CHECK_OUT") => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          location: locationNote
        })
      });

      const result = await res.json();

      if (!res.ok) {
        toastError(result.error || "Action failed.");
      } else {
        if (action === "CHECK_IN") {
          if (result.status === "LATE") {
            toastWarning(`Checked in at ${result.checkInTime} (Late check-in recorded)`);
          } else {
            toastSuccess(`Checked in successfully at ${result.checkInTime}!`);
          }
        } else {
          toastSuccess(`Checked out successfully at ${result.checkOutTime}! Total logged: ${result.formattedDuration}`);
        }
        await fetchDashboard();
      }
    } catch (err: any) {
      toastError("Network error recording attendance.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Staff Attendance Dashboard">
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 mt-2">Loading attendance portal...</p>
        </div>
      </AppLayout>
    );
  }

  const todayRecord = data?.today?.record;
  const isOnLeave = data?.today?.isOnLeave;
  const leaveDetails = data?.today?.leaveDetails;

  const isCheckedIn = !!(todayRecord && todayRecord.check_in_time);
  const isCheckedOut = !!(todayRecord && todayRecord.check_out_time);

  // Status computation for prompt
  const hasCompleted = isCheckedIn && isCheckedOut;

  // Working hours formatting helper
  const formatWorkingHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <AppLayout title="Contract Staff Attendance Dashboard">
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-2">
                <ShieldAlert className="w-3.5 h-3.5" />
                Staff ID: {data?.staff?.staff_id || user?.staffId || "DVLA-CS"}
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Welcome back, {data?.staff?.full_name || user?.name}!
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-1">
                {data?.staff?.position} • {data?.staff?.department_name}
              </p>
            </div>

            <Link
              href="/leave"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-900 text-xs font-bold shadow-md hover:bg-emerald-50 transition-all self-start md:self-auto"
            >
              <Send className="w-3.5 h-3.5" /> Apply for Leave
            </Link>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-6 translate-y-6">
            <CalendarCheck className="w-56 h-56" />
          </div>
        </div>

        {/* 19. IMPORTANT UX REQUIREMENT: Check-in / Check-out Core Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-500/20 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left side details */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-lg">
                  Daily Attendance Terminal
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  30 September 2026
                </span>
              </div>

              {/* State 1: On Approved Leave */}
              {isOnLeave ? (
                <div>
                  <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
                    On Approved Leave
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                    You have an approved {leaveDetails?.leave_type || "casual"} leave until {leaveDetails?.end_date}. Check-in is exempt for today.
                  </p>
                </div>
              ) : !isCheckedIn ? (
                /* State 2: Not Checked In */
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-400">Status</div>
                  <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-300 dark:bg-slate-700 animate-pulse" />
                    Not Checked In
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Working hours standard: 08:00 AM - 05:00 PM (15m grace period)
                  </p>
                </div>
              ) : !isCheckedOut ? (
                /* State 3: Checked In (In Progress) */
                <div>
                  <div className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    Checked In Today
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-1">
                    {todayRecord.check_in_time}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        todayRecord.status === "LATE"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200"
                          : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200"
                      }`}
                    >
                      Status: {todayRecord.status}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {todayRecord.check_in_location || "Head Office Cantonments"}
                    </span>
                  </div>
                </div>
              ) : (
                /* State 4: Attendance Complete */
                <div>
                  <div className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Attendance Complete
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-2">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[11px] text-slate-500 block uppercase font-medium">Check-In</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {todayRecord.check_in_time}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[11px] text-slate-500 block uppercase font-medium">Check-Out</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {todayRecord.check_out_time}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 col-span-2 sm:col-span-1">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block uppercase font-medium">Working Hours</span>
                      <span className="text-base sm:text-lg font-bold text-emerald-800 dark:text-emerald-200 font-mono">
                        {formatWorkingHours(todayRecord.working_minutes)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Tag */}
              <div className="pt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Station:</span>
                <input
                  type="text"
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  className="bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:outline-none focus:border-emerald-500 text-xs px-1 text-slate-700 dark:text-slate-300"
                />
              </div>
            </div>

            {/* Right side: Action Button */}
            <div className="flex flex-col items-center justify-center shrink-0">
              {isOnLeave ? (
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold text-center max-w-xs">
                  Leave approved for today. No check-in required.
                </div>
              ) : !isCheckedIn ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setIsCameraModalOpen(true)}
                  className="w-full sm:w-56 h-20 sm:h-24 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-base sm:text-lg shadow-xl shadow-emerald-600/30 flex flex-col items-center justify-center gap-1 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-6 h-6 animate-pulse" />
                  <span>CHECK IN (BIOMETRIC)</span>
                  <span className="text-[10px] opacity-80 font-normal">Open Live Webcam</span>
                </button>
              ) : !isCheckedOut ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleAttendanceAction("CHECK_OUT")}
                  className="w-full sm:w-56 h-20 sm:h-24 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-extrabold text-lg sm:text-xl shadow-xl shadow-rose-600/30 flex flex-col items-center justify-center gap-1 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <>
                      <Clock4 className="w-6 h-6" />
                      <span>CHECK OUT</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center w-full sm:w-56">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-1" />
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                    Day Completed
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    Thank you for your service today
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Days Worked
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
              {data?.stats?.totalDaysWorked || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Cumulative approved days</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Late Check-ins
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
              {data?.stats?.totalLate || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Arrived past 08:15 AM</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Hours Worked
              </span>
              <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/80 text-teal-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
              {data?.stats?.totalHoursWorked || 0}h
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Logged on duty</span>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Leave Days
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
              {data?.stats?.totalLeave || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Approved leave days taken</span>
          </div>
        </div>

        {/* Recent Attendance History Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Recent Attendance History
              </h3>
              <p className="text-xs text-slate-500">Your recent check-in and working duration records</p>
            </div>
            <Link
              href="/attendance"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              Full History <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4">Working Hours</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {data?.recentAttendances?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No past records found.
                    </td>
                  </tr>
                ) : (
                  data?.recentAttendances?.map((att: any) => (
                    <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 font-mono">
                        {att.date}
                      </td>
                      <td className="py-3 px-4 font-mono">{att.check_in_time || "—"}</td>
                      <td className="py-3 px-4 font-mono">{att.check_out_time || "—"}</td>
                      <td className="py-3 px-4 font-mono">
                        {att.working_minutes > 0 ? formatWorkingHours(att.working_minutes) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            att.status === "PRESENT"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : att.status === "LATE"
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                              : att.status === "ON_LEAVE"
                              ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {att.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {att.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Biometric Webcam Check-In Modal */}
      <BiometricWebcamModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        staffIdentifier={data?.staff?.staff_id || user?.staffId || user?.email || ""}
        onExistingSuccess={() => {
          fetchDashboard();
        }}
        title="Webcam Biometric Check-In"
        subtitle="Align face to verify attendance with biometric webcam"
      />
    </AppLayout>
  );
}
