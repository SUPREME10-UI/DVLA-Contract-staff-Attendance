"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Building,
  UserCheck,
  UserX,
  Loader2,
  Shield
} from "lucide-react";

export default function ReportsPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const now = new Date();
  const defaultEnd = now.toISOString().substring(0, 10);
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [reportType, setReportType] = useState("DAILY");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [departments, setDepartments] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);

  // Load departments
  useEffect(() => {
    fetch("/api/staff?limit=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.departments) setDepartments(d.departments);
      })
      .catch(() => {});
  }, []);

  const handleGenerateReport = async () => {
    setLoading(true);
    try {
      const url = `/api/reports?type=${reportType}&startDate=${startDate}&endDate=${endDate}&departmentId=${deptFilter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
        toastSuccess("Report generated successfully!");
      } else {
        toastError("Failed to generate report.");
      }
    } catch {
      toastError("Network error generating report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerateReport();
  }, []);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!reportData || !reportData.records?.length) {
      toastError("No data available to export.");
      return;
    }

    const headers = [
      "Date",
      "Staff ID",
      "Staff Name",
      "Ghana Card",
      "Department",
      "Position",
      "Check-In",
      "Check-Out",
      "Working Minutes",
      "Status"
    ];

    const rows = reportData.records.map((r: any) => [
      `"${r.date}"`,
      `"${r.staff_id}"`,
      `"${r.full_name}"`,
      `"${r.ghana_card}"`,
      `"${r.department_name}"`,
      `"${r.position}"`,
      `"${r.check_in_time || ""}"`,
      `"${r.check_out_time || ""}"`,
      r.working_minutes || 0,
      `"${r.status}"`
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DVLA_Attendance_Report_${reportType}_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toastSuccess("CSV report downloaded successfully!");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout title="Attendance Reports & Exports">
      <div className="space-y-6">
        {/* Controls Header (Hidden in Print) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm no-print">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4" /> Official Reporting Suite
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                Generate Attendance & Audit Reports
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Compile compliant logs, exports, and printable summaries for internal and executive audits
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleExportCSV}
                disabled={!reportData?.records?.length}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Export Excel/CSV
              </button>
              <button
                onClick={handlePrint}
                disabled={!reportData?.records?.length}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </button>
            </div>
          </div>

          {/* Form Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold uppercase text-slate-500 mb-1">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="DAILY">Daily Attendance Report</option>
                <option value="WEEKLY">Weekly Summary Report</option>
                <option value="MONTHLY">Monthly Comprehensive Report</option>
                <option value="LATE">Late Attendance Report</option>
                <option value="ABSENCE">Absence & Leave Report</option>
                <option value="HOURS">Working Hours Verification Report</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold uppercase text-slate-500 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-slate-500 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase text-slate-500 mb-1">
                Department
              </label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleGenerateReport}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
              Generate Report
            </button>
          </div>
        </div>

        {/* Printable Official Report Document Container */}
        {reportData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-10 space-y-6">
            {/* 9. Organization Header */}
            <div className="border-b-2 border-emerald-600 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-800 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {reportData.organization.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {reportData.organization.address} • Tel: {reportData.organization.phone} • {reportData.organization.email}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs">
                <span className="inline-block px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold uppercase text-[10px]">
                  {reportData.meta.reportType} REPORT
                </span>
                <div className="text-slate-500 text-[11px] mt-1">
                  Period: <strong className="text-slate-800 dark:text-slate-200">{reportData.meta.startDate}</strong> to{" "}
                  <strong className="text-slate-800 dark:text-slate-200">{reportData.meta.endDate}</strong>
                </div>
                <div className="text-slate-400 text-[10px] mt-0.5">
                  Generated by {reportData.meta.generatedBy} on {new Date(reportData.meta.generatedAt).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Entries</span>
                <span className="text-lg font-black text-slate-900 dark:text-slate-100">{reportData.summary.totalRecords}</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-semibold block">Present</span>
                <span className="text-lg font-black text-emerald-800 dark:text-emerald-200">{reportData.summary.totalPresent}</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] text-amber-700 dark:text-amber-300 uppercase font-semibold block">Late</span>
                <span className="text-lg font-black text-amber-800 dark:text-amber-200">{reportData.summary.totalLate}</span>
              </div>

              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-semibold block">On Leave</span>
                <span className="text-lg font-black text-blue-800 dark:text-blue-200">{reportData.summary.totalLeave}</span>
              </div>

              <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-teal-700 dark:text-teal-300 uppercase font-semibold block">Total Hours</span>
                <span className="text-lg font-black text-teal-800 dark:text-teal-200">{reportData.summary.totalHours}h</span>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 uppercase font-bold text-[10px] border-y border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Staff ID</th>
                    <th className="py-2.5 px-3">Staff Name</th>
                    <th className="py-2.5 px-3">Ghana Card</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Check-In</th>
                    <th className="py-2.5 px-3">Check-Out</th>
                    <th className="py-2.5 px-3">Hours</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {reportData.records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No attendance records found for this period.
                      </td>
                    </tr>
                  ) : (
                    reportData.records.map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono">{r.date}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold">{r.staff_id}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">{r.full_name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{r.ghana_card}</td>
                        <td className="py-2.5 px-3 text-slate-500">{r.department_name}</td>
                        <td className="py-2.5 px-3 font-mono">{r.check_in_time || "—"}</td>
                        <td className="py-2.5 px-3 font-mono">{r.check_out_time || "—"}</td>
                        <td className="py-2.5 px-3 font-mono">
                          {r.working_minutes > 0
                            ? `${Math.floor(r.working_minutes / 60)}h ${r.working_minutes % 60}m`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              r.status === "PRESENT"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.status === "LATE"
                                ? "bg-amber-100 text-amber-800"
                                : r.status === "ON_LEAVE"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Official Report Footer with Signature Lines */}
            <div className="pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs text-slate-500">
              <div>
                <div className="h-10 border-b border-dashed border-slate-300 dark:border-slate-700" />
                <span className="block mt-1 font-semibold text-slate-700 dark:text-slate-300">
                  Compiled By: {reportData.meta.generatedBy}
                </span>
                <span className="text-[10px] text-slate-400">Authorized Human Resources / Officer</span>
              </div>

              <div>
                <div className="h-10 border-b border-dashed border-slate-300 dark:border-slate-700" />
                <span className="block mt-1 font-semibold text-slate-700 dark:text-slate-300">
                  Verified By: Head of Internal Audit
                </span>
                <span className="text-[10px] text-slate-400">Driver & Vehicle Licensing Authority</span>
              </div>

              <div className="col-span-2 sm:col-span-1 text-right sm:text-right flex flex-col justify-end">
                <span className="text-[10px] text-slate-400">DVLA Official Attendance Management System</span>
                <span className="text-[10px] text-slate-400">ISO 9001:2015 Compliant Quality Records</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
