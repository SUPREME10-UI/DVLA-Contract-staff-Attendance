"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import {
  UserCog,
  UserPlus,
  Search,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Trash2,
  AlertTriangle
} from "lucide-react";

export default function UsersPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Add User Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ADMIN",
    phone: "",
    title: "System Administrator"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete User Confirmation Modal
  const [deleteModalUser, setDeleteModalUser] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      let url = `/api/users?role=${roleFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch {
      toastError("Failed to fetch user accounts.");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, search, toastError]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (targetUser: any) => {
    const nextStatus = targetUser.is_active === 1 ? 0 : 1;
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUser.id, isActive: nextStatus === 1 })
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "User status updated.");
        await fetchUsers();
      } else {
        toastError(data.error || "Failed to update status.");
      }
    } catch {
      toastError("Network error updating status.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalUser) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users?userId=${encodeURIComponent(deleteModalUser.id)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || `User account "${deleteModalUser.name}" deleted successfully.`);
        setDeleteModalUser(null);
        await fetchUsers();
      } else {
        toastError(data.error || "Failed to delete user.");
      }
    } catch {
      toastError("Network error deleting user.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        toastSuccess(data.message || "User account created successfully!", "Success");
        setIsAddOpen(false);
        setForm({
          name: "",
          email: "",
          password: "",
          role: "ADMIN",
          phone: "",
          title: "System Administrator"
        });
        await fetchUsers();
      } else {
        toastError(data.error || "Failed to create user.");
      }
    } catch {
      toastError("Network error creating user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout title="User Accounts Administration">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <UserCog className="w-4 h-4" /> Identity & Access Control
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              Portal User Accounts
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage login credentials, roles, and administrative access privileges
            </p>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Add Officer / Administrator
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or contact number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full md:w-auto px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Administrator</option>
              <option value="STAFF">Contract Staff</option>
            </select>
          </div>
        </div>

        {/* User Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Staff ID / Title</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      Loading user accounts...
                    </td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No user accounts found.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px] uppercase">
                            {u.name.charAt(0)}
                          </div>
                          {u.name}
                        </div>
                        {u.phone && <div className="text-[10px] text-slate-400 mt-0.5">{u.phone}</div>}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {u.email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === "ADMIN"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                        {u.staff_id || u.position || "System Officer"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.is_active === 1
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          }`}
                        >
                          {u.is_active === 1 ? "ACTIVE" : "DISABLED"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {u.id !== user?.id && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                                u.is_active === 1
                                  ? "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              }`}
                            >
                              {u.is_active === 1 ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => setDeleteModalUser(u)}
                              title="Delete user"
                              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Create Administrative Account
                </h3>
                <p className="text-slate-500">Provision a system administrator account</p>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5 mt-4">
              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cynthia Mensah"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Corporate Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. cynthia.mensah@dvla.gov.gh"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Temporary Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Role
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
                  >
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+233 24 ..."
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Provision Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-sm border border-rose-200 dark:border-rose-900/50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Delete User Account
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Are you sure you want to permanently delete user account{" "}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    &ldquo;{deleteModalUser.name}&rdquo;
                  </span>{" "}
                  (<span className="font-mono text-emerald-600 dark:text-emerald-400">{deleteModalUser.email}</span>)?
                </p>
                <div className="mt-3.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <span className="font-bold shrink-0">Warning:</span>
                  <span>This action cannot be undone. All login credentials and linked records for this user will be permanently removed.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Yes, Delete Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
