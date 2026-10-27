"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import {
  CalendarCheck,
  Search,
  Filter,
  Calendar,
  Clock,
  Edit2,
  Eye,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

export default function AttendancePage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState(""); // empty means all or specific
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [departments, setDepartments] = useState<any[]>([]);

  // Modals
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const [correctingRecord, setCorrectingRecord] = useState<any | null>(null);
  const [correctInTime, setCorrectInTime] = useState("");
  const [correctOutTime, setCorrectOutTime] = useState("");
  const [correctStatus, setCorrectStatus] = useState("PRESENT");
  const [correctReason, setCorrectReason] = useState("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // Load Departments once
  useEffect(() => {
    fetch("/api/staff?limit=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.departments) setDepartments(d.departments);
      })
      .catch(() => {});
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/attendance?page=${page}&limit=20&departmentId=${deptFilter}&status=${statusFilter}`;
      if (dateFilter) url += `&date=${dateFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      toastError("Failed to fetch attendance logs.");
    } finally {
      setLoading(false);
    }
  }, [page, deptFilter, statusFilter, dateFilter, search, toastError]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
      toastError("Reason is mandatory for attendance corrections.");
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
        toastError(resJson.error || "Failed to update record.");
      } else {
        toastSuccess("Attendance record adjusted and logged in audit trail!");
        setCorrectingRecord(null);
        await fetchRecords();
      }
    } catch {
      toastError("Error saving record correction.");
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <AppLayout title="Attendance Records">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarCheck className="w-4 h-4" /> Comprehensive Attendance Logs
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              Attendance Verification & Records
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing official time logs, duration calculations, and administrative correction notes
            </p>
          </div>

          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all self-start sm:self-auto"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Attendance
          </Link>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by staff name, ID (DVLA-CS-...), or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Date filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              title="Filter by specific date"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="text-xs text-rose-500 hover:underline px-1"
              >
                Clear date
              </button>
            )}

            {/* Department Filter */}
            {user?.role !== "STAFF" && (
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="EARLY">Early</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>
        </div>

        {/* 7. Attendance Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Staff ID</th>
                  <th className="py-3.5 px-4">Staff Name</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Check-In</th>
                  <th className="py-3.5 px-4">Check-Out</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      Loading attendance records...
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No attendance records match your filter criteria.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {r.date}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {r.staff_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {r.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400">{r.position}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {r.department_name}
                      </td>
                      <td className="py-3.5 px-4 font-mono">{r.check_in_time || "—"}</td>
                      <td className="py-3.5 px-4 font-mono">{r.check_out_time || "—"}</td>
                      <td className="py-3.5 px-4 font-mono">
                        {r.working_minutes > 0
                          ? `${Math.floor(r.working_minutes / 60)}h ${r.working_minutes % 60}m`
                          : "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === "PRESENT"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                : r.status === "LATE"
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                : r.status === "ON_LEAVE"
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {r.status}
                          </span>
                          {r.is_corrected === 1 && (
                            <span
                              className="px-1 py-0.2 rounded text-[9px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                              title={`Amended by ${r.corrected_by}: ${r.correction_reason}`}
                            >
                              CORRECTED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewRecord(r)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="View Record Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => openCorrection(r)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Correct Record"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {records.length} of {total} records (Page {page} of {totalPages})
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-slate-700 dark:text-slate-300 px-1">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Record Details Modal (Requirement 7) */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Attendance Record Details
                </h3>
                <p className="text-slate-500">
                  {viewRecord.full_name} ({viewRecord.staff_id}) • {viewRecord.date}
                </p>
              </div>
              <button
                onClick={() => setViewRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div>
                  <span className="text-slate-400 block uppercase font-medium">Department</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{viewRecord.department_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-medium">Ghana Card</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">{viewRecord.ghana_card}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-medium">Exact Check-In</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">{viewRecord.check_in_time || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-medium">Exact Check-Out</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">{viewRecord.check_out_time || "N/A"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-medium">Total Duration</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                    {viewRecord.working_minutes > 0 ? `${Math.floor(viewRecord.working_minutes / 60)}h ${viewRecord.working_minutes % 60}m` : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase font-medium">Status</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{viewRecord.status}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block uppercase font-medium mb-0.5">Terminal / Location Tag</span>
                <span className="text-slate-700 dark:text-slate-300">{viewRecord.check_in_location || "Standard DVLA Cantonments Station"}</span>
              </div>

              {viewRecord.notes && (
                <div>
                  <span className="text-slate-400 block uppercase font-medium mb-0.5">Notes</span>
                  <span className="text-slate-700 dark:text-slate-300">{viewRecord.notes}</span>
                </div>
              )}

              {viewRecord.is_corrected === 1 && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                  <span className="font-bold text-purple-700 dark:text-purple-300 block mb-0.5">Administrative Amendment Recorded:</span>
                  <div className="text-slate-600 dark:text-slate-300">
                    Corrected by: <span className="font-semibold">{viewRecord.corrected_by}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                    Reason: {viewRecord.correction_reason}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewRecord(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Amending Record (Admin Correction)
                </h3>
                <p className="text-slate-500">
                  Staff: {correctingRecord.full_name} ({correctingRecord.staff_id}) • Date: {correctingRecord.date}
                </p>
              </div>
              <button
                onClick={() => setCorrectingRecord(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCorrection} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Check-In Time
                  </label>
                  <input
                    type="text"
                    required
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
                  Administrative Reason (Audit trail requirement) *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State reason: e.g., verified biometric reader delay on site log sheet."
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCorrection}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCorrection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save & Record Audit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
