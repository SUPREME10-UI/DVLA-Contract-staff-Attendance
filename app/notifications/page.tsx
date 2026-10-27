"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  AlertCircle,
  Check,
  ExternalLink,
  Loader2
} from "lucide-react";

export default function NotificationsPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");

  const fetchNotifs = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      toastError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, []);

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true })
      });
      if (res.ok) {
        toastSuccess("All notifications marked as read.");
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
        setUnreadCount(0);
      }
    } catch {
      toastError("Error updating notifications.");
    }
  };

  const markSingleRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id })
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const filteredNotifs =
    filter === "UNREAD" ? notifications.filter((n) => !n.is_read) : notifications;

  const getIcon = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case "WARNING":
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case "ALERT":
        return <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <AppLayout title="Notifications Center">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Bell className="w-4 h-4" /> System Alerts
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              Notifications & Announcements
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Attendance confirmations, leave statuses, and administrative alerts
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer self-start sm:self-auto"
            >
              <Check className="w-3.5 h-3.5" /> Mark all as read ({unreadCount})
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              filter === "ALL"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("UNREAD")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              filter === "UNREAD"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
            }`}
          >
            Unread Only ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
              Loading notifications...
            </div>
          ) : filteredNotifs.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              No notifications to display.
            </div>
          ) : (
            filteredNotifs.map((n) => (
              <div
                key={n.id}
                onClick={() => !n.is_read && markSingleRead(n.id)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 cursor-pointer ${
                  n.is_read
                    ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-75"
                    : "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-sm"
                }`}
              >
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0">
                  {getIcon(n.type)}
                </div>

                <div className="flex-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {n.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {n.message}
                  </p>

                  <div className="mt-3 flex items-center justify-between">
                    {n.link ? (
                      <Link
                        href={n.link}
                        className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        View relevant section <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <div />
                    )}

                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
