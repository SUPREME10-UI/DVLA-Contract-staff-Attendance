"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  Menu,
  Sun,
  Moon,
  Bell,
  Clock,
  CheckCircle,
  ExternalLink
} from "lucide-react";

interface NavbarProps {
  onMenuClick: () => void;
  title?: string;
}

export function Navbar({ onMenuClick, title }: NavbarProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric"
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 20000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true })
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {}
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Left side: Hamburger & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition-colors cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {title && (
          <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 hidden sm:block tracking-tight">
            {title}
          </h1>
        )}
      </div>

      {/* Right side: Live clock, notifications, dark mode, user avatar */}
      <div className="flex items-center gap-2 sm:gap-3.5">
        {/* Live Clock Card */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 font-medium shadow-xs">
          <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          <span>{currentDate}</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
            {currentTime}
          </span>
        </div>

        {/* Dark / Light Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="p-2 relative rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotifOpen(false)}
              />
              <div className="absolute right-0 mt-2 z-50 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <CheckCircle className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 py-2">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 text-xs rounded-xl transition-colors ${
                          n.is_read
                            ? "opacity-80 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            : "bg-emerald-50/70 dark:bg-emerald-950/20"
                        }`}
                      >
                        <div className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                          {n.title}
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 line-clamp-2">
                          {n.message}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400 font-mono">
                          {new Date(n.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 text-center">
                  <Link
                    href="/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                  >
                    View all notifications <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Mini Profile Button */}
        {user && (
          user.role === "STAFF" ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {user.name.charAt(0)}
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none">
                  {user.name}
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold leading-none mt-1">
                  {user.role}
                </div>
              </div>
            </div>
          ) : (
            <Link
              href="/profile"
              className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 hover:opacity-85 transition-opacity"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {user.name.charAt(0)}
              </div>
              <div className="hidden xl:block text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none">
                  {user.name}
                </div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold leading-none mt-1">
                  {user.role}
                </div>
              </div>
            </Link>
          )
        )}
      </div>
    </header>
  );
}
