"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDanger = false,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isDanger
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700 shadow-sm"
                : "bg-emerald-600 hover:bg-emerald-700 shadow-sm"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
