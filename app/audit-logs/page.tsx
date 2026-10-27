"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import {
  ShieldAlert,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Shield,
  Loader2
} from "lucide-react";

export default function AuditLogsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/audit-logs?page=${page}&limit=25&action=${actionFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      toast("Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, search, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action: string) => {
    if (action.includes("CREATE") || action.includes("LOGIN") || action.includes("APPROVED")) {
      return "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200";
    }
    if (action.includes("CORRECTION") || action.includes("UPDATE")) {
      return "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200";
    }
    if (action.includes("DEACTIVATE") || action.includes("REJECT")) {
      return "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200";
    }
    return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200";
  };

  return (
    <AppLayout title="System Audit Logs">
      <div className="space-y-6">
        {/* Header */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Compliance & Security Trail
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            Immutable Audit Trail Logs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically timestamped record of administrative interventions, staff onboarding, attendance corrections, and security activities
          </p>
        </div>

        {/* Filters */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by action, user name, or description keyword..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="w-full md:w-auto">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full md:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="ALL">All Event Actions</option>
              <option value="ATTENDANCE_CHECK_IN">ATTENDANCE_CHECK_IN</option>
              <option value="ATTENDANCE_CHECK_OUT">ATTENDANCE_CHECK_OUT</option>
              <option value="ATTENDANCE_CORRECTION">ATTENDANCE_CORRECTION</option>
              <option value="STAFF_CREATED">STAFF_CREATED</option>
              <option value="STAFF_DEACTIVATED">STAFF_DEACTIVATED</option>
              <option value="LEAVE_APPROVED">LEAVE_APPROVED</option>
              <option value="LEAVE_REJECTED">LEAVE_REJECTED</option>
              <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
              <option value="USER_LOGIN">USER_LOGIN</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      Loading audit logs...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      No audit events found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {log.user_name}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          {log.user_role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-md leading-relaxed text-slate-600 dark:text-slate-300">
                        {log.description}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {log.ip_address}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {logs.length} of {total} audit records (Page {page} of {totalPages})
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
    </AppLayout>
  );
}
