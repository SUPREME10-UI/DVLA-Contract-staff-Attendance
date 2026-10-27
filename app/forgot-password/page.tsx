"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setSubmitted(true);
      setMessage(data.message || "Reset instructions sent.");
    } catch {
      setMessage("Failed to process request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-slate-100 to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 text-slate-900 dark:text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 mb-3">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Reset Password
        </h2>
        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
          DVLA Attendance Account Recovery
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 sm:px-10 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-800">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Instructions Dispatched
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {message}
              </p>
              <div className="pt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Enter your registered corporate email address. We will verify your credentials and send a password recovery notification to your administrator.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Corporate Email Address
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="Enter your registered corporate email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...
                  </>
                ) : (
                  "Request Password Reset"
                )}
              </button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
