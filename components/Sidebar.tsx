"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  FileSpreadsheet,
  CalendarDays,
  Bell,
  ShieldAlert,
  Settings,
  UserCog,
  LogOut,
  User
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (!user) return null;

  let dashHref = "/staff/dashboard";
  if (user.role === "ADMIN") dashHref = "/admin/dashboard";

  const navItems = [
    {
      label: "Dashboard",
      href: dashHref,
      icon: LayoutDashboard,
      roles: ["ADMIN", "STAFF"]
    },
    {
      label: "Contract Staff",
      href: "/staff",
      icon: Users,
      roles: ["ADMIN"]
    },
    {
      label: "Attendance Records",
      href: "/attendance",
      icon: CalendarCheck,
      roles: ["ADMIN", "STAFF"]
    },
    {
      label: "Reports & Export",
      href: "/reports",
      icon: FileSpreadsheet,
      roles: ["ADMIN"]
    },
    {
      label: "Leave Management",
      href: "/leave",
      icon: CalendarDays,
      roles: ["ADMIN", "STAFF"]
    },
    {
      label: "Notifications",
      href: "/notifications",
      icon: Bell,
      roles: ["ADMIN", "STAFF"]
    },
    {
      label: "Audit Logs",
      href: "/audit-logs",
      icon: ShieldAlert,
      roles: ["ADMIN"]
    },
    {
      label: "User Accounts",
      href: "/users",
      icon: UserCog,
      roles: ["ADMIN"]
    },
    {
      label: "Attendance Settings",
      href: "/settings",
      icon: Settings,
      roles: ["ADMIN"]
    },
    {
      label: "My Profile",
      href: "/profile",
      icon: User,
      roles: ["ADMIN"]
    }
  ];

  const allowedNav = navItems.filter((item) => item.roles.includes(user.role));

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800";
    }
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-68 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-sm transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200/90 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center">
            <Image
              src="/dvla-logo.png"
              alt="DVLA Logo"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <div>
            <div className="font-extrabold text-slate-900 dark:text-white text-base leading-tight tracking-tight flex items-center gap-1.5">
              DVLA GHANA
            </div>
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Contract Attendance
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Portal Menu
          </div>
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== dashHref && pathname.startsWith(item.href));

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/25 font-bold"
                    : "text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* User Card */}
        <div className="p-3.5 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {user.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border ${getRoleBadge(
                      user.role
                    )}`}
                  >
                    {user.role}
                  </span>
                  {user.staffId && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-medium">
                      {user.staffId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
