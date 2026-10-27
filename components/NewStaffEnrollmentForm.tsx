"use client";

import React, { useState, useEffect } from "react";
import {
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Camera,
  RefreshCw,
  Building,
  CreditCard,
  Phone,
  Mail,
  Calendar,
  Lock,
  User,
  MapPin,
  Loader2,
  X,
  ArrowRight,
  ChevronDown
} from "lucide-react";

interface NewStaffEnrollmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  biometricPhoto: string | null;
  faceFeatures?: any;
  onRetakeBiometric: () => void;
  initialIdentifier?: string;
  onSuccess?: (data: any) => void;
}

export function NewStaffEnrollmentForm({
  isOpen,
  onClose,
  biometricPhoto,
  faceFeatures,
  onRetakeBiometric,
  initialIdentifier = "",
  onSuccess
}: NewStaffEnrollmentFormProps) {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Success state: "Thank you" with green checkmark
  const [isSuccess, setIsSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    ghanaCard: "",
    email: initialIdentifier.includes("@") ? initialIdentifier : "",
    phone: "",
    gender: "MALE",
    dob: "1998-05-15",
    address: "Accra, Greater Accra",
    departmentId: "",
    position: "Customer Support & Operations Clerk",
    emergencyContact: "",
    emergencyPhone: "",
    password: "Staff@123",
    registrationNotes: "Enrolled via customer side webcam biometric registration"
  });

  // Fetch departments for dropdown
  useEffect(() => {
    if (!isOpen) return;
    setIsSuccess(false);
    setSubmitError(null);

    const fetchDepartments = async () => {
      setLoadingDepts(true);
      try {
        // Use public /api/departments — no auth required, works for unauthenticated new staff
        const res = await fetch("/api/departments");
        if (res.ok) {
          const data = await res.json();
          if (data.departments && data.departments.length > 0) {
            setDepartments(data.departments);
            setFormData((prev) => ({
              ...prev,
              departmentId: prev.departmentId || data.departments[0].id
            }));
          } else {
            throw new Error("No departments returned");
          }
        } else {
          throw new Error("Departments fetch failed: " + res.status);
        }
      } catch {
        // Fallback to seeded DVLA department IDs if API is temporarily unavailable
        const fallback = [
          { id: "dept-csl", name: "Customer Service & Licensing", code: "CSL" },
          { id: "dept-vir", name: "Vehicle Inspection & Registration", code: "VIR" },
          { id: "dept-dtt", name: "Driver Training & Testing", code: "DTT" },
          { id: "dept-it", name: "Information Technology", code: "IT" },
          { id: "dept-hr", name: "Human Resource Management", code: "HR" }
        ];
        setDepartments(fallback);
        setFormData((prev) => ({
          ...prev,
          departmentId: prev.departmentId || fallback[0].id
        }));
      } finally {
        setLoadingDepts(false);
      }
    };

    fetchDepartments();
  }, [isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.fullName.trim() || !formData.ghanaCard.trim() || !formData.phone.trim() || !formData.email.trim()) {
      setSubmitError("Please fill in your Full Name, Ghana Card ID, Phone, and Email.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/staff/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          biometricImage: biometricPhoto,
          faceFeatures
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || "Failed to register new contract staff.");
      } else {
        setIsSuccess(true);
        setSuccessInfo(data);
        if (onSuccess) {
          onSuccess(data);
        }
      }
    } catch (err: any) {
      setSubmitError("Network error while submitting registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-emerald-900 to-teal-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">New Staff Biometric Enrollment</h3>
              <p className="text-xs text-emerald-100/80">
                Driver & Vehicle Licensing Authority • Contract Staff Registration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* SUCCESS STATE: "THANK YOU" WITH GREEN CORRECT MARK */}
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center text-center space-y-5 animate-in zoom-in-95 duration-300">
              {/* Correct mark in green with glowing rings */}
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 animate-ping absolute" />
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 z-10">
                  <CheckCircle2 className="w-14 h-14 stroke-[2.5]" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
                  Registration Saved at Admin Side
                </span>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white pt-2">
                  Thank You!
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
                  Your biometric photo and contract staff enrollment have been successfully submitted and saved in the DVLA Admin records.
                </p>
              </div>

              {/* Summary of registered credentials */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 text-xs space-y-2 text-left">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Assigned Staff ID:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {successInfo?.staff?.staffId}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Full Name:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {successInfo?.staff?.fullName}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Ghana Card:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {successInfo?.staff?.ghanaCard}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Biometric Status:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Enrolled & Saved to Admin
                  </span>
                </div>
              </div>

              {/* Next Steps Buttons */}
              <div className="w-full flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Done (Back to Terminal)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (typeof window !== "undefined") {
                      window.location.href = successInfo?.redirectUrl || "/staff/dashboard";
                    }
                  }}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            /* FORM STATE: BIOMETRIC PREVIEW + INPUT FIELDS */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Biometric Snapshot Attached Header Card */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border-2 border-emerald-500 shadow-md shrink-0">
                    {biometricPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={biometricPhoto}
                        alt="Captured biometric preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-[8px] text-white font-black text-center py-0.5 uppercase tracking-tighter">
                      Biometric
                    </div>
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Face Biometric Captured
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                      This photo will be saved on the Admin Side as your verified biometric identity.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onRetakeBiometric}
                  className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-50 flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
              </div>

              {/* Error Alert */}
              {submitError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Full Name */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Full Legal Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      name="fullName"
                      required
                      placeholder="e.g. Kwame Mensah"
                      value={formData.fullName}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Ghana Card Number */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Ghana Card (NIA) Number *
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      name="ghanaCard"
                      required
                      placeholder="e.g. GHA-718293849-5"
                      value={formData.ghanaCard}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="e.g. kwame@dvla.gov.gh"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="e.g. +233 24 123 4567"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Department Selection */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    DVLA Department *
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                    {loadingDepts ? (
                      <div className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Loading departments...</span>
                      </div>
                    ) : (
                      <>
                        <select
                          name="departmentId"
                          value={formData.departmentId}
                          onChange={handleChange}
                          required
                          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium appearance-none cursor-pointer"
                        >
                          {departments.length === 0 && (
                            <option value="" disabled>No departments available</option>
                          )}
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name} ({dept.code})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </>
                    )}
                  </div>
                </div>

                {/* Position / Role */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Position / Role *
                  </label>
                  <input
                    type="text"
                    name="position"
                    required
                    placeholder="e.g. Licensing Assistant / Vehicle Examiner"
                    value={formData.position}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Gender
                  </label>
                  <div className="relative">
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-3 pr-9 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium appearance-none cursor-pointer"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Residential Address */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Residential Address & City
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      name="address"
                      placeholder="e.g. House 42, Spintex Road, Accra"
                      value={formData.address}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Emergency Contact Name */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    name="emergencyContact"
                    placeholder="e.g. Mary Mensah (Spouse/Parent)"
                    value={formData.emergencyContact}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Emergency Contact Phone */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    name="emergencyPhone"
                    placeholder="e.g. +233 20 999 8888"
                    value={formData.emergencyPhone}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Account Password */}
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px] mb-1">
                    Set Security Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="Create your login password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Default is <span className="font-mono font-bold">Staff@123</span>. You can change this to your preferred secure password.
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Admin Side...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Submit & Save to Admin</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
