"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { AdminBiometricModal } from "@/components/AdminBiometricModal";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Eye,
  Edit2,
  UserCheck,
  UserX,
  Phone,
  Building,
  Calendar,
  CreditCard,
  Loader2,
  X,
  CheckCircle2,
  Camera,
  ShieldCheck,
  Sparkles,
  MapPin,
  Mail,
  Fingerprint,
  BadgeCheck,
  BadgeAlert,
  SwitchCamera,
  Upload,
  RotateCcw,
  Trash2
} from "lucide-react";
import { extractCanvasVisualFeatures } from "@/lib/face-matcher";

// Dynamically import face-api — avoids SSR issues
let faceapi: any = null;
let modelsLoaded = false;
let modelsLoading = false;

async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelsLoading) {
    while (modelsLoading) await new Promise((r) => setTimeout(r, 200));
    return modelsLoaded;
  }
  modelsLoading = true;
  try {
    faceapi = await import("@vladmandic/face-api");
    const MODEL_URL = "/models";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
    modelsLoading = false;
    return true;
  } catch {
    modelsLoading = false;
    return false;
  }
}

async function extractFaceDescriptor(
  canvas: HTMLCanvasElement
): Promise<number[] | null> {
  if (!faceapi || !modelsLoaded) return null;
  try {
    const det = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!det) return null;
    return Array.from(det.descriptor as Float32Array);
  } catch {
    return null;
  }
}

export default function StaffManagementPage() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [staffList, setStaffList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State: Add Staff
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: "",
    ghanaCard: "",
    phone: "",
    email: "",
    gender: "MALE",
    dob: "",
    address: "",
    departmentId: "",
    position: "",
    contractStart: "2026-01-01",
    contractEnd: "2027-12-31",
    customStaffId: "",
    biometricPhoto: null as string | null,
    faceFeatures: null as any | null
  });
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Modal Camera States for Add Staff Biometrics
  const addVideoRef = useRef<HTMLVideoElement | null>(null);
  const addCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const addStreamRef = useRef<MediaStream | null>(null);
  const [isAddCameraActive, setIsAddCameraActive] = useState(false);
  const [addFacingMode, setAddFacingMode] = useState<"user" | "environment">("user");
  const [addCameraError, setAddCameraError] = useState<string | null>(null);
  const [isExtractingAddFace, setIsExtractingAddFace] = useState(false);

  // Modal State: Status Confirmation (Deactivate / Reactivate)
  const [statusModalStaff, setStatusModalStaff] = useState<any | null>(null);
  const [statusReason, setStatusReason] = useState("");

  // View Biometric modal state
  const [viewBiometricStaff, setViewBiometricStaff] = useState<any | null>(null);

  // Admin Biometric Enrollment Modal
  const [biometricModalStaff, setBiometricModalStaff] = useState<any | null>(null);

  // Load face-api models on page mount
  useEffect(() => {
    loadFaceApiModels();
  }, []);

  const handleStopAddCamera = useCallback(() => {
    if (addStreamRef.current) {
      addStreamRef.current.getTracks().forEach((t) => t.stop());
      addStreamRef.current = null;
    }
    setIsAddCameraActive(false);
  }, []);

  const handleStartAddCamera = useCallback(async () => {
    handleStopAddCamera();
    setAddCameraError(null);
    setIsAddCameraActive(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam not supported in browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: addFacingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      addStreamRef.current = stream;
      if (addVideoRef.current) {
        addVideoRef.current.srcObject = stream;
        await addVideoRef.current.play();
      }
    } catch (err: any) {
      setAddCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access in browser."
          : "Webcam not detected or unavailable."
      );
      setIsAddCameraActive(false);
    }
  }, [addFacingMode, handleStopAddCamera]);

  const handleCaptureAddSnapshot = async () => {
    const video = addVideoRef.current;
    if (!video || video.readyState < 2) return;

    const canvas = addCanvasRef.current || document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    handleStopAddCamera();
    setIsExtractingAddFace(true);

    const visualFeatures = extractCanvasVisualFeatures(canvas);
    const desc = await extractFaceDescriptor(canvas);
    setIsExtractingAddFace(false);

    const features = {
      ...visualFeatures,
      descriptor: desc || undefined
    };

    setAddForm((prev) => ({
      ...prev,
      biometricPhoto: dataUrl,
      faceFeatures: features
    }));
  };

  const handleAddFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const img = new Image();
      img.onload = async () => {
        const canvas = addCanvasRef.current || document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setIsExtractingAddFace(true);
          const visualFeatures = extractCanvasVisualFeatures(canvas);
          const desc = await extractFaceDescriptor(canvas);
          setIsExtractingAddFace(false);
          const features = {
            ...visualFeatures,
            descriptor: desc || undefined
          };
          setAddForm((prev) => ({
            ...prev,
            biometricPhoto: result,
            faceFeatures: features
          }));
        }
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const handleCloseAddModal = () => {
    handleStopAddCamera();
    setIsAddOpen(false);
  };

  const fetchStaff = useCallback(async () => {
    try {
      let url = `/api/staff?departmentId=${deptFilter}&status=${statusFilter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff || []);
        setDepartments(data.departments || []);
        if (data.departments?.length > 0 && !addForm.departmentId) {
          setAddForm((prev) => ({ ...prev, departmentId: data.departments[0].id }));
        }
      }
    } catch {
      toastError("Failed to fetch contract staff records.");
    } finally {
      setLoading(false);
    }
  }, [deptFilter, statusFilter, search, toastError, addForm.departmentId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAdd(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          biometricImage: addForm.biometricPhoto,
          faceFeatures: addForm.faceFeatures
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || "Failed to create staff member.");
      } else {
        toastSuccess(data.message || "Contract staff registered successfully!", "Success");
        handleStopAddCamera();
        setIsAddOpen(false);
        setAddForm({
          fullName: "",
          ghanaCard: "",
          phone: "",
          email: "",
          gender: "MALE",
          dob: "",
          address: "",
          departmentId: departments[0]?.id || "",
          position: "",
          contractStart: "2026-01-01",
          contractEnd: "2027-12-31",
          customStaffId: "",
          biometricPhoto: null,
          faceFeatures: null
        });
        await fetchStaff();
      }
    } catch {
      toastError("Network error adding staff.");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleConfirmStatusToggle = async () => {
    if (!statusModalStaff) return;
    const newStatus = statusModalStaff.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      const res = await fetch(`/api/staff/${statusModalStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason || "Administrative status adjustment"
        })
      });

      const data = await res.json();
      if (res.ok) {
        toastSuccess(`Staff member status changed to ${newStatus}.`);
        setStatusModalStaff(null);
        setStatusReason("");
        await fetchStaff();
      } else {
        toastError(data.error || "Failed to update staff status.");
      }
    } catch {
      toastError("Network error updating status.");
    }
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <AppLayout title="Contract Staff Directory">
      <div className="space-y-6">
        {/* Header & Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div>
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
              <Users className="w-4 h-4" /> Personnel Directory
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
              Contract Staff Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage biometric ID, Ghana Card credentials, assignments, and employment status
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all self-start sm:self-auto cursor-pointer"
            >
              <UserPlus className="w-4 h-4" /> Add Contract Staff
            </button>
          )}
        </div>


        {/* Filters and Search Bar */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, Staff ID (DVLA-CS-...), email, or Ghana Card..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive / Deactivated</option>
            </select>
          </div>
        </div>

        {/* Staff Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Staff ID</th>
                  <th className="py-3.5 px-4">Full Name</th>
                  <th className="py-3.5 px-4">Ghana Card / ID</th>
                  <th className="py-3.5 px-4">Department &amp; Role</th>
                  <th className="py-3.5 px-4">Contract Period</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Biometric</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      Loading staff records...
                    </td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No contract staff records matching filter criteria.
                    </td>
                  </tr>
                ) : (
                  staffList.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {s.staff_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {/* Biometric Avatar */}
                          <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 border border-slate-300 dark:border-slate-600 flex items-center justify-center">
                            {s.avatar || s.biometric_data ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={s.avatar || s.biometric_data}
                                alt={s.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                {s.full_name?.charAt(0) || "S"}
                              </span>
                            )}
                            {(s.avatar || s.biometric_data) && (
                              <div
                                className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900"
                                title="Webcam Biometric Captured"
                              />
                            )}
                          </div>

                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                              <span>{s.full_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {s.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {s.ghana_card}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{s.position}</div>
                        <div className="text-[11px] text-slate-500">{s.department_name}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-500 font-mono">
                        {s.contract_start} to {s.contract_end}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.status === "ACTIVE"
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>

                      {/* Biometric Status Column */}
                      <td className="py-3.5 px-4 text-center">
                        {(s.biometric_data || s.face_features) ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800"
                            title={`Biometric captured${s.biometric_captured_at ? ": " + new Date(s.biometric_captured_at).toLocaleDateString("en-GH") : ""}`}
                          >
                            <BadgeCheck className="w-3 h-3" /> Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                            <BadgeAlert className="w-3 h-3" /> None
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Admin: Biometric enrollment / management button */}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setBiometricModalStaff(s)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                (s.biometric_data || s.face_features)
                                  ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                  : "text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              }`}
                              title={(s.biometric_data || s.face_features) ? "Manage Biometric (Update / Delete)" : "Enroll Biometric — No biometric on file"}
                            >
                              <Fingerprint className="w-4 h-4" />
                            </button>
                          )}

                          {/* View full profile */}
                          <Link
                            href={`/staff/${s.id}`}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="View Full Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {isAdmin && (
                            <button
                              onClick={() => setStatusModalStaff(s)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                s.status === "ACTIVE"
                                  ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              }`}
                              title={s.status === "ACTIVE" ? "Deactivate Staff" : "Reactivate Staff"}
                            >
                              {s.status === "ACTIVE" ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Staff Modal (Section 4 & 8) */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Register Contract Staff Member
                </h3>
                <p className="text-xs text-slate-500">
                  Enroll staff credentials, Ghana Card, and contract dates
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Samuel Yaw Adomako"
                    value={addForm.fullName}
                    onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Ghana Card / National ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="GHA-XXXXXXXXX-X"
                    value={addForm.ghanaCard}
                    onChange={(e) => setAddForm({ ...addForm, ghanaCard: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Corporate / Contact Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. samuel.adomako@dvla.gov.gh"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+233 24 000 0000"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Department *
                  </label>
                  <select
                    value={addForm.departmentId}
                    onChange={(e) => setAddForm({ ...addForm, departmentId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Position / Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Driver Licensing Assistant"
                    value={addForm.position}
                    onChange={(e) => setAddForm({ ...addForm, position: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Contract Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={addForm.contractStart}
                    onChange={(e) => setAddForm({ ...addForm, contractStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Contract End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={addForm.contractEnd}
                    onChange={(e) => setAddForm({ ...addForm, contractEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                    Staff ID (Leave blank to auto-generate)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DVLA-CS-009"
                    value={addForm.customStaffId}
                    onChange={(e) => setAddForm({ ...addForm, customStaffId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              {/* Staff Biometric Face Capture Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Fingerprint className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Biometric Face Enrollment
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Enroll staff photo now so the AI camera terminal will automatically recognize them and take attendance
                      </p>
                    </div>
                  </div>

                  {addForm.biometricPhoto && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-300 dark:border-emerald-800">
                      <BadgeCheck className="w-3.5 h-3.5" /> Biometric Ready
                    </span>
                  )}
                </div>

                {/* State 1: Photo already captured */}
                {addForm.biometricPhoto ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60">
                    <img
                      src={addForm.biometricPhoto}
                      alt="Enrolled Face"
                      className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
                    />
                    <div className="flex-1 text-center sm:text-left space-y-1">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center sm:justify-start gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Face Biometric Encoded
                      </p>
                      <p className="text-[11px] text-slate-500">
                        128-point face descriptor computed. The staff member will be automatically detected and marked present when facing the camera terminal.
                      </p>
                      <div className="pt-1 flex items-center justify-center sm:justify-start gap-2">
                        <button
                          type="button"
                          onClick={handleStartAddCamera}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" /> Retake Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddForm(prev => ({ ...prev, biometricPhoto: null, faceFeatures: null }))}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : isAddCameraActive ? (
                  /* State 2: Live Camera Viewfinder */
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden bg-black border-2 border-emerald-500 shadow-md">
                      <video
                        ref={addVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                      {/* Face alignment guide */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-52 rounded-[50%] border-2 border-dashed border-emerald-400/80 animate-pulse flex items-center justify-center">
                          <span className="text-[10px] text-emerald-300 font-bold bg-black/60 px-2 py-0.5 rounded-full">
                            Align Face Here
                          </span>
                        </div>
                      </div>

                      {/* Video Camera Controls */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        <button
                          type="button"
                          onClick={() => setAddFacingMode(prev => prev === "user" ? "environment" : "user")}
                          className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/80 transition cursor-pointer"
                          title="Switch camera"
                        >
                          <SwitchCamera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCaptureAddSnapshot}
                        disabled={isExtractingAddFace}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                      >
                        {isExtractingAddFace ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing Face...
                          </>
                        ) : (
                          <>
                            <Camera className="w-3.5 h-3.5" /> Capture Face Snapshot
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleStopAddCamera}
                        className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        Cancel Camera
                      </button>
                    </div>

                    {addCameraError && (
                      <p className="text-[11px] text-rose-500 font-medium">{addCameraError}</p>
                    )}
                  </div>
                ) : (
                  /* State 3: Idle - Camera or Upload Option */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleStartAddCamera}
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-emerald-600" />
                      <span>Take Live Webcam Photo</span>
                    </button>

                    <label className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold transition cursor-pointer">
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Upload Staff Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAddFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdd}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAdd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Register Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate/Reactivate Confirmation Dialog */}
      {statusModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              {statusModalStaff.status === "ACTIVE" ? "Deactivate Contract Staff" : "Reactivate Contract Staff"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              Are you sure you want to change status for{" "}
              <strong className="text-slate-900 dark:text-slate-100">
                {statusModalStaff.full_name} ({statusModalStaff.staff_id})
              </strong>
              ?{" "}
              {statusModalStaff.status === "ACTIVE" &&
                "Once deactivated, this staff member will be prohibited from daily attendance check-in."}
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Reason (Logged in audit trail)
              </label>
              <input
                type="text"
                placeholder="e.g. Contract expiration / administrative review"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setStatusModalStaff(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl ${
                  statusModalStaff.status === "ACTIVE" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {statusModalStaff.status === "ACTIVE" ? "Yes, Deactivate" : "Yes, Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* View Biometric Face Snapshot Modal */}
      {viewBiometricStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Biometric Face Scan & Enrollment Record
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Saved from customer side webcam registration
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewBiometricStaff(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Photo Column */}
              <div className="flex flex-col items-center justify-center text-center space-y-2">
                <div className="relative w-36 h-44 rounded-2xl overflow-hidden bg-slate-950 border-2 border-emerald-500/50 shadow-lg">
                  {viewBiometricStaff.avatar || viewBiometricStaff.biometric_data ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={viewBiometricStaff.avatar || viewBiometricStaff.biometric_data}
                      alt={viewBiometricStaff.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-[10px]">No Photo</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-white font-bold text-[9px] py-0.5 text-center uppercase tracking-wider">
                    Webcam Capture
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3 h-3" /> Biometric Verified
                </span>
              </div>

              {/* Data Column */}
              <div className="sm:col-span-2 space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Full Name</span>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {viewBiometricStaff.full_name}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Staff ID</span>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {viewBiometricStaff.staff_id}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Ghana Card</span>
                    <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {viewBiometricStaff.ghana_card}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Department</span>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {viewBiometricStaff.department_name}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Position</span>
                    <div className="font-medium text-slate-800 dark:text-slate-200">
                      {viewBiometricStaff.position}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Phone</span>
                    <div className="text-slate-700 dark:text-slate-300">{viewBiometricStaff.phone}</div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Email</span>
                    <div className="text-slate-700 dark:text-slate-300 truncate">{viewBiometricStaff.email}</div>
                  </div>
                </div>

                {viewBiometricStaff.emergency_contact && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Emergency Contact</span>
                    <div className="text-slate-800 dark:text-slate-200 font-medium">
                      {viewBiometricStaff.emergency_contact} ({viewBiometricStaff.emergency_phone || "No phone"})
                    </div>
                  </div>
                )}

                {viewBiometricStaff.is_new_registration === 1 && (
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[11px] flex items-center gap-1.5 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Submitted by staff member via customer web enrollment form.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewBiometricStaff(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Biometric Enrollment / Management Modal */}
      {isAdmin && (
        <AdminBiometricModal
          isOpen={!!biometricModalStaff}
          onClose={() => setBiometricModalStaff(null)}
          staff={biometricModalStaff ? {
            id: biometricModalStaff.id,
            staffId: biometricModalStaff.staff_id,
            fullName: biometricModalStaff.full_name,
            department: biometricModalStaff.department_name,
            hasBiometric: !!biometricModalStaff.has_face_descriptor,
            capturedAt: biometricModalStaff.biometric_captured_at || null,
            avatarPreview: biometricModalStaff.avatar || biometricModalStaff.biometric_data || null
          } : null}
          onSuccess={async () => {
            await fetchStaff();
          }}
        />
      )}
    </AppLayout>
  );
}
