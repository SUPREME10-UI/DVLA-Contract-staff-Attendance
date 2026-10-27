"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import {
  CalendarDays,
  PlusCircle,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Loader2
} from "lucide-react";

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("ALL");

  // Apply Modal
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [startDate, setStartDate] = useState("2026-10-01");
  const [endDate, setEndDate] = useState("2026-10-03");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reject Modal
  const [rejectingReq, setRejectingReq] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/leave?status=${statusTab}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch {
      toastError("Failed to fetch leave requests.");
    } finally {
      setLoading(false);
    }
  }, [statusTab, toastError]);

  useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toastError("Please state a reason for this leave request.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveType, startDate, endDate, reason })
      });

      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "Leave request submitted for approval!", "Success");
        setIsApplyOpen(false);
        setReason("");
        await fetchLeaveRequests();
      } else {
        toastError(data.error || "Failed to submit leave request.");
      }
    } catch {
      toastError("Error submitting leave application.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/leave", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, status: "APPROVED" })
      });
      if (res.ok) {
        toastSuccess("Leave request approved. Attendance records updated to On Leave!");
        await fetchLeaveRequests();
      } else {
        toastError("Failed to approve leave request.");
      }
    } catch {
      toastError("Network error approving leave.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReq) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/leave", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: rejectingReq.id,
          status: "REJECTED",
          rejectionReason: rejectReason || "Administrative discretion"
        })
      });
      if (res.ok) {
        toastSuccess("Leave request rejected.");
        setRejectingReq(null);
        setRejectReason("");
        await fetchLeaveRequests();
      } else {
        toastError("Failed to reject leave request.");
      }
    } catch {
      toastError("Network error rejecting leave.");
    } finally {
      setActionLoading(false);
    }
  };

  const canApprove = user?.role === "ADMIN";

  return (
    <AppLayout title="Leave Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" /> Absence Administration
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              Leave Requests & Approvals
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Apply for leave, review department requests, and manage attendance exemptions
            </p>
          </div>

          <button
            onClick={() => setIsApplyOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Apply for Leave
          </button>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 max-w-md text-xs font-semibold">
          {["ALL", "PENDING", "APPROVED", "REJECTED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusTab === tab
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Leave Requests List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
              Loading leave requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              No leave requests found in this category.
            </div>
          ) : (
            requests.map((lr) => (
              <div
                key={lr.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {lr.full_name}
                    </span>
                    <span className="font-mono text-slate-400 text-xs">({lr.staff_id})</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {lr.leave_type} LEAVE
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        lr.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : lr.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {lr.status}
                    </span>
                  </div>

                  <div className="text-slate-500 font-medium">
                    {lr.position} • {lr.department_name}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-400 pt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Duration: <strong className="text-slate-800 dark:text-slate-200">{lr.start_date}</strong> to{" "}
                      <strong className="text-slate-800 dark:text-slate-200">{lr.end_date}</strong>
                    </span>

                    <span className="text-slate-400">•</span>
                    <span>Reason: &ldquo;{lr.reason}&rdquo;</span>
                  </div>

                  {lr.status === "APPROVED" && lr.approved_by && (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Approved by {lr.approved_by}
                    </div>
                  )}

                  {lr.status === "REJECTED" && lr.rejection_reason && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      ✕ Rejected: {lr.rejection_reason}
                    </div>
                  )}
                </div>

                {/* Admin Actions */}
                {canApprove && lr.status === "PENDING" && (
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleApprove(lr.id)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => {
                        setRejectingReq(lr);
                        setRejectReason("");
                      }}
                      className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Apply Leave Modal */}
      {isApplyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Submit Leave Request
                </h3>
                <p className="text-slate-500">Apply for formal absence from scheduled duty</p>
              </div>
              <button
                onClick={() => setIsApplyOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4 mt-4">
              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Leave Category
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                >
                  <option value="ANNUAL">Annual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="CASUAL">Casual / Personal Leave</option>
                  <option value="MATERNITY">Maternity / Paternity Leave</option>
                  <option value="BEREAVEMENT">Bereavement Leave</option>
                  <option value="STUDY">Study / Examination Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Reason for Leave Request *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detail the reason and any handover notes..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsApplyOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
              Reject Leave Application
            </h3>
            <p className="text-slate-500 mb-3">
              Staff: {rejectingReq.full_name} ({rejectingReq.staff_id})
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Reason for Rejection (Visible to staff)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Critical operational coverage required for scheduled vehicle inspections."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRejectingReq(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
