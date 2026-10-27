"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import Image from "next/image";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2
} from "lucide-react";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const router = useRouter();

  // Credential-based login for Admin and Staff
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      toastError("Please enter your email/Staff ID and password.");
      return;
    }

    setIsSubmitting(true);
    const res = await login(identifier, password);
    setIsSubmitting(false);

    if (res.success) {
      toastSuccess("Authentication successful. Redirecting...", "Welcome");
      if (res.redirectUrl) {
        router.push(res.redirectUrl);
      }
    } else {
      toastError(res.error || "Login failed. Please verify your credentials.");
    }
  };


  return (
    <div className="relative min-h-screen flex flex-col justify-center py-10 sm:px-6 lg:px-8 text-slate-900 dark:text-slate-100 overflow-hidden">
      {/* Blurred DVLA Head Office Background Image */}
      <div
        className="absolute -inset-6 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: "url('/dvla-bg.jpg')",
          filter: "blur(8px)",
          transform: "scale(1.08)",
        }}
      />
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-slate-950/45 dark:bg-slate-950/65 pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 w-full sm:mx-auto sm:max-w-md px-4 sm:px-0 space-y-4">
        {/* Regular Login Form Card */}
        <div className="bg-white/95 dark:bg-slate-900/95 py-8 px-6 sm:px-8 shadow-2xl rounded-2xl border border-white/20 dark:border-slate-800 backdrop-blur-md">
          {/* Organization Header inside Card */}
          <div className="text-center mb-6">
            <div className="mx-auto w-24 h-24 mb-3 animate-in fade-in zoom-in-95 flex items-center justify-center">
              <Image
                src="/dvla-logo.png"
                alt="DVLA Ghana Official Logo"
                width={96}
                height={96}
                className="object-contain drop-shadow-md"
                priority
              />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              DVLA T.S.A Portal
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              DVLA Temporary Staff Attendance Portal
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Identifier input */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Email Address or Staff ID
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  required
                  placeholder="Enter your email or Staff ID"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Password input */}
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Enter your security password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-1.5 text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-md shadow-emerald-700/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...
                </>
              ) : (
                "Sign In to Portal"
              )}
            </button>
          </form>


        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-200 drop-shadow flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Secure Portal Login &bull; DVLA Official System</span>
        </div>
      </div>
    </div>
  );
}

