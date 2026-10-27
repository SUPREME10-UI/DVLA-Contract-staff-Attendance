"use client";

import React, { useEffect, useState, use } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import {
  User,
  Shield,
  CreditCard,
  Phone,
  Mail,
  Calendar,
  Building,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Edit3,
  Loader2,
  Check,
  X
} from "lucide-react";

export default function StaffProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/staff/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.staff);
        setStats(data.stats);
        setAttendances(data.recentAttendances || []);
        setLeaves(data.leaveHistory || []);
        setEditForm({
          fullName: data.staff.full_name,
          phone: data.staff.phone,
          email: data.staff.email,
          position: data.staff.position,
          address: data.staff.address || "",
          contractStart: data.staff.contract_start,
          contractEnd: data.staff.contract_end
        });
      } else {
        toastError("Unable to load staff profile.");
      }
    } catch {
      toastError("Network error fetching profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        toastSuccess("Profile updated successfully!");
        setIsEditing(false);
        await fetchProfile();
      } else {
        toastError("Failed to update profile.");
      }
    } catch {
      toastError("Error saving updates.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Staff Profile">
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 mt-2">Loading staff profile...</p>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout title="Staff Not Found">
        <div className="text-center py-16">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Staff Record Not Found</h2>
          <Link href="/staff" className="text-xs text-emerald-600 hover:underline mt-2 inline-block">
            ← Return to staff list
          </Link>
        </div>
      </AppLayout>
    );
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <AppLayout title={`Staff Profile - ${profile.full_name}`}>
      <div className="space-y-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/staff"
            className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Staff Directory
          </Link>

          {isAdmin && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit Information
            </button>
          )}
        </div>

        {/* Profile Card Header */}
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white font-bold text-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0 uppercase">
              {profile.full_name.charAt(0)}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                  {profile.full_name}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    profile.status === "ACTIVE"
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {profile.status}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                {profile.position} • {profile.department_name} ({profile.department_code})
              </p>

              <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-3 text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1.5 font-mono">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  Staff ID: <strong className="text-slate-900 dark:text-slate-100">{profile.staff_id}</strong>
                </span>

                <span className="flex items-center gap-1.5 font-mono">
                  <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                  Ghana Card: <strong className="text-slate-900 dark:text-slate-100">{profile.ghana_card}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form Modal/Section */}
        {isEditing && (
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-emerald-500/40 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Edit Staff Information
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.fullName}
                    onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Position
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.position}
                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Contract Start
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.contractStart}
                    onChange={(e) => setEditForm({ ...editForm, contractStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Contract End
                  </label>
                  <input
                    type="date"
                    required
                    value={editForm.contractEnd}
                    onChange={(e) => setEditForm({ ...editForm, contractEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold uppercase text-slate-500">Days Recorded</span>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {stats?.totalDaysRecorded || 0}
            </div>
            <span className="text-[10px] text-slate-400">{stats?.presentDays || 0} on-time days</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold uppercase text-slate-500">Late Days</span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {stats?.lateDays || 0}
            </div>
            <span className="text-[10px] text-slate-400">Punctuality alert</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold uppercase text-slate-500">Approved Leave</span>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {stats?.leaveDays || 0}
            </div>
            <span className="text-[10px] text-slate-400">Days authorized</span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold uppercase text-slate-500">Total Hours</span>
            <div className="text-xl font-black text-teal-600 dark:text-teal-400 mt-1">
              {stats?.totalHours || 0}h
            </div>
            <span className="text-[10px] text-slate-400">Cumulative logged</span>
          </div>
        </div>

        {/* Attendance History */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Recent Attendance Log
            </h3>
            <p className="text-xs text-slate-500">Daily clock-in, clock-out and duration history</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Check-In</th>
                  <th className="py-3 px-4">Check-Out</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {attendances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No attendance records found for this staff member.
                    </td>
                  </tr>
                ) : (
                  attendances.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {a.date}
                      </td>
                      <td className="py-3 px-4 font-mono">{a.check_in_time || "—"}</td>
                      <td className="py-3 px-4 font-mono">{a.check_out_time || "—"}</td>
                      <td className="py-3 px-4 font-mono">
                        {a.working_minutes > 0
                          ? `${Math.floor(a.working_minutes / 60)}h ${a.working_minutes % 60}m`
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            a.status === "PRESENT"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : a.status === "LATE"
                              ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                              : a.status === "ON_LEAVE"
                              ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                              : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-[150px]">
                        {a.check_in_location || "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-[200px]">
                        {a.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
