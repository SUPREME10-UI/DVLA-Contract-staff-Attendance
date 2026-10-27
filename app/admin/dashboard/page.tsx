"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  FileSpreadsheet,
  UserPlus,
  ArrowRight,
  TrendingUp,
  Building,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Eye,
  Edit,
  Loader2,
  X,
  Sparkles
} from "lucide-react";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Correction Modal State
  const [correctingRecord, setCorrectingRecord] = useState<any | null>(null);
  const [correctInTime, setCorrectInTime] = useState("");
  const [correctOutTime, setCorrectOutTime] = useState("");
  const [correctStatus, setCorrectStatus] = useState("PRESENT");
  const [correctReason, setCorrectReason] = useState("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const todayIso = new Date().toISOString().substring(0, 10);
      const res = await fetch(`/api/dashboard?date=${todayIso}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      toastError("Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const openCorrection = (record: any) => {
    setCorrectingRecord(record);
    setCorrectInTime(record.check_in_time || "08:00:00");
    setCorrectOutTime(record.check_out_time || "17:00:00");
    setCorrectStatus(record.status || "PRESENT");
    setCorrectReason("");
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctReason) {
      toastError("Please state an administrative reason for this correction.");
      return;
    }

    setIsSubmittingCorrection(true);
    try {
      const res = await fetch("/api/attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: correctingRecord.id,
          checkInTime: correctInTime,
          checkOutTime: correctOutTime,
          status: correctStatus,
          reason: correctReason
        })
      });

      const resJson = await res.json();
      if (!res.ok) {
        toastError(resJson.error || "Failed to correct record.");
      } else {
        toastSuccess("Attendance record corrected and audit log recorded!");
        setCorrectingRecord(null);
        await fetchDashboard();
      }
    } catch {
      toastError("Error saving attendance correction.");
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Executive Attendance Dashboard">
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 mt-2">Loading administrative portal...</p>
        </div>
      </AppLayout>
    );
  }

  const stats = data?.stats;

  return (
    <AppLayout title="Administrator Attendance Command Center">
      <div className="space-y-6">
        {/* Welcome Header & Quick Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" /> Chief Administrator Console
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              Welcome, {user?.name || "Administrator"}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live attendance monitoring & management for Driver and Vehicle Licensing Authority (DVLA)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/staff"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Contract Staff
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Generate Reports
            </Link>
          </div>
        </div>

        {/* 18. Core Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Staff */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Total Staff
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
              {stats?.totalStaff || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {stats?.activeStaff || 0} active contract personnel
            </span>
          </div>

          {/* Present Today */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Present Today
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats?.presentToday || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {stats?.currentlyCheckedIn || 0} currently on duty
            </span>
          </div>

          {/* Late Today */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Late Today
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/80 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats?.lateToday || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Past 08:15 AM threshold</span>
          </div>

          {/* Absent / Not Checked In */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
                Absent / Pending
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center">
                <UserX className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-2xl font-black text-rose-600 dark:text-rose-400">
              {stats?.absentToday || 0}
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {stats?.onLeaveToday || 0} on authorized leave
            </span>
          </div>
        </div>

        {/* Charts & Breakdown Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly Attendance Trends Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" /> Attendance Overview Trend
                </h3>
                <p className="text-xs text-slate-500">7-day attendance volume and punctuality breakdown</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present
                </span>
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late
                </span>
                <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> On Leave
                </span>
              </div>
            </div>

            {/* Clean SVG Trend Visualization */}
            <div className="h-52 w-full pt-4 flex items-end justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
              {data?.trendData?.map((item: any) => {
                const maxVal = Math.max(8, ...data.trendData.map((t: any) => t.present + t.late + t.onLeave));
                const pHeight = Math.round((item.present / maxVal) * 140);
                const lHeight = Math.round((item.late / maxVal) * 140);
                const vHeight = Math.round((item.onLeave / maxVal) * 140);

                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="w-full max-w-[32px] flex flex-col items-center justify-end h-40">
                      {/* Stacked bars */}
                      {item.onLeave > 0 && (
                        <div
                          style={{ height: `${vHeight}px` }}
                          className="w-full bg-blue-400 dark:bg-blue-600 rounded-t-sm transition-all"
                          title={`On Leave: ${item.onLeave}`}
                        />
                      )}
                      {item.late > 0 && (
                        <div
                          style={{ height: `${lHeight}px` }}
                          className="w-full bg-amber-400 dark:bg-amber-500 transition-all"
                          title={`Late: ${item.late}`}
                        />
                      )}
                      {item.present > 0 && (
                        <div
                          style={{ height: `${pHeight}px` }}
                          className="w-full bg-emerald-500 dark:bg-emerald-600 rounded-b-sm transition-all"
                          title={`Present: ${item.present}`}
                        />
                      )}
                      {item.present === 0 && item.late === 0 && item.onLeave === 0 && (
                        <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded" />
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100 mt-2">
                      {item.dayName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {item.present + item.late}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Standard shift: 08:00 - 17:00</span>
              <span>Total hours recorded today: {stats?.totalHoursWorkedToday || 0}h</span>
            </div>
          </div>

          {/* Attendance by Department */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
                <Building className="w-4 h-4 text-emerald-600" /> Department Attendance
              </h3>
              <p className="text-xs text-slate-500 mb-4">Staff turnout per operational division</p>

              <div className="space-y-3.5">
                {data?.deptBreakdown?.map((dept: any) => {
                  const percent = dept.staff_count > 0 ? Math.round((dept.attended_today / dept.staff_count) * 100) : 0;
                  return (
                    <div key={dept.id} className="text-xs">
                      <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
                        <span className="truncate max-w-[180px]">{dept.name} ({dept.code})</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {dept.attended_today} / {dept.staff_count} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            percent >= 80 ? "bg-emerald-500" : percent >= 50 ? "bg-amber-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 text-right">
              <Link
                href="/attendance"
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
              >
                View full logs <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 18. Today's Attendance Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" /> Today&apos;s Attendance Records (30 September 2026)
              </h3>
              <p className="text-xs text-slate-500">Live roster of checked-in personnel and status flags</p>
            </div>

            <Link
              href="/attendance"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              Open Full Attendance Table <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Staff ID</th>
                  <th className="py-3 px-4">Staff Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {data?.todayAttendance?.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No attendance activity recorded yet today.
                    </td>
                  </tr>
                ) : (
                  data?.todayAttendance?.map((rec: any) => (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {rec.staff_id}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {rec.full_name}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{rec.department_name}</td>
                      <td className="py-3 px-4 font-mono">{rec.check_in_time || "—"}</td>
                      <td className="py-3 px-4 font-mono">{rec.check_out_time || "—"}</td>
                      <td className="py-3 px-4 font-mono">
                        {rec.working_minutes > 0
                          ? `${Math.floor(rec.working_minutes / 60)}h ${rec.working_minutes % 60}m`
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            rec.status === "PRESENT"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : rec.status === "LATE"
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                              : rec.status === "ON_LEAVE"
                              ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => openCorrection(rec)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 transition-colors"
                        >
                          <Edit className="w-3 h-3" /> Correct
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 18. Recent Activity / Audit Log Preview */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Recent Administrative Activity & Audit Trail
              </h3>
              <p className="text-xs text-slate-500">Security event logs, attendance changes, and approvals</p>
            </div>
            <Link
              href="/audit-logs"
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              Full Audit Logs <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {data?.recentActivity?.map((log: any) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                  {log.user_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {log.user_name}
                      <span className="ml-1.5 text-[10px] font-normal text-slate-400">({log.user_role})</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {log.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin Correction Modal (Rule 6, 7) */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Correct Attendance Record
                </h3>
                <p className="text-xs text-slate-500">
                  Staff: {correctingRecord.full_name} ({correctingRecord.staff_id}) • Date: {correctingRecord.date}
                </p>
              </div>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Check-In Time
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="08:00:00"
                    value={correctInTime}
                    onChange={(e) => setCorrectInTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Check-Out Time
                  </label>
                  <input
                    type="text"
                    placeholder="17:00:00"
                    value={correctOutTime}
                    onChange={(e) => setCorrectOutTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Status
                </label>
                <select
                  value={correctStatus}
                  onChange={(e) => setCorrectStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="EARLY">EARLY</option>
                  <option value="HALF_DAY">HALF_DAY</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Reason for Correction (Required for Audit Log) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Biometric reader network timeout; verified on physical logsheet."
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCorrection}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCorrection ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Save & Log Correction"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
