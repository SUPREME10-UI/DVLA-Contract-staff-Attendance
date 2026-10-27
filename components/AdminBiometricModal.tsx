"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Trash2,
  ShieldCheck,
  Fingerprint,
  Loader2,
  SwitchCamera,
  Upload,
  RotateCcw,
  BadgeCheck,
  UserCircle,
  AlertTriangle
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

interface AdminBiometricModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: {
    id: string;
    staffId: string;
    fullName: string;
    department: string;
    hasBiometric: boolean;
    capturedAt?: string | null;
    avatarPreview?: string | null;
  } | null;
  onSuccess: () => void;
}

export function AdminBiometricModal({
  isOpen,
  onClose,
  staff,
  onSuccess
}: AdminBiometricModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [descriptor, setDescriptor] = useState<number[] | null>(null);
  const [computedFeatures, setComputedFeatures] = useState<any | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [faceQuality, setFaceQuality] = useState<"none" | "poor" | "good">("none");

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [deletedSuccess, setDeletedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load face-api on mount
  useEffect(() => {
    loadFaceApiModels().then(setModelsReady);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Webcam not supported.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setHasCamera(true);
    } catch (err: any) {
      setHasCamera(false);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in your browser."
          : "Webcam not available. You can upload a photo instead."
      );
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      setDescriptor(null);
      setFaceQuality("none");
      setSavedSuccess(false);
      setDeletedSuccess(false);
      setConfirmDelete(false);
      setError(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  const handleCapture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPhoto(dataUrl);
    stopCamera();

    // Extract perceptual visual features
    const visualFeatures = extractCanvasVisualFeatures(canvas);

    // Extract face descriptor for quality + recognition
    setExtracting(true);
    setFaceQuality("none");
    const desc = await extractFaceDescriptor(canvas);
    setExtracting(false);
    if (desc) {
      setDescriptor(desc);
      setComputedFeatures({ ...visualFeatures, descriptor: desc });
      setFaceQuality("good");
    } else {
      setDescriptor(null);
      setComputedFeatures({ ...visualFeatures });
      setFaceQuality("poor");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = async () => {
        const canvas = canvasRef.current || document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        setCapturedPhoto(dataUrl);
        stopCamera();
        const visualFeatures = extractCanvasVisualFeatures(canvas);
        setExtracting(true);
        const desc = await extractFaceDescriptor(canvas);
        setExtracting(false);
        setDescriptor(desc);
        setComputedFeatures({ ...visualFeatures, descriptor: desc || undefined });
        setFaceQuality(desc ? "good" : "poor");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setDescriptor(null);
    setComputedFeatures(null);
    setFaceQuality("none");
    setError(null);
    startCamera();
  };

  const handleSave = async () => {
    if (!capturedPhoto || !staff) return;
    if (!descriptor || descriptor.length !== 128) {
      setError("A clear face must be detected before enrollment. Please retake or upload a clear face photo.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/staff/${staff.id}/biometric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biometricImage: capturedPhoto,
          faceFeatures: computedFeatures || (descriptor ? { descriptor } : null)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSavedSuccess(true);
        onSuccess();
      } else {
        setError(data.error || "Failed to save biometric.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!staff) return;
    setError(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/staff/${staff.id}/biometric`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDeletedSuccess(true);
        setConfirmDelete(false);
        onSuccess();
      } else {
        setError(data.error || "Failed to delete biometric.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 flex items-center justify-center">
              <Fingerprint className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Biometric Enrollment
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {staff.fullName} &bull; {staff.staffId}
              </p>
            </div>
          </div>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Staff Info Badge */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
              <UserCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{staff.fullName}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{staff.department} &bull; {staff.staffId}</p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
              staff.hasBiometric
                ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
            }`}>
              {staff.hasBiometric ? (
                <><BadgeCheck className="w-3 h-3" /> Enrolled</>
              ) : (
                <><AlertCircle className="w-3 h-3" /> Not Enrolled</>
              )}
            </div>
          </div>

          {/* Existing biometric preview */}
          {staff.hasBiometric && staff.avatarPreview && !capturedPhoto && !savedSuccess && !deletedSuccess && (
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Biometric on File
              </p>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={staff.avatarPreview}
                  alt="Current biometric"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-400/50 shadow-md"
                />
                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Face descriptor stored
                  </div>
                  {staff.capturedAt && (
                    <p className="text-slate-500">Captured: {new Date(staff.capturedAt).toLocaleString("en-GH")}</p>
                  )}
                  <p className="text-slate-400 text-[11px]">Capture a new photo below to update.</p>
                </div>
              </div>
            </div>
          )}

          {/* Success States */}
          {savedSuccess && (
            <div className="py-6 flex flex-col items-center text-center space-y-3 animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                <CheckCircle2 className="w-12 h-12 text-white stroke-[2.5]" />
              </div>
              <div>
                <p className="font-black text-xl text-slate-900 dark:text-white">Biometric Saved!</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  {staff.fullName}&apos;s face is now registered. They will be auto-detected at the terminal.
                </p>
              </div>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {deletedSuccess && (
            <div className="py-6 flex flex-col items-center text-center space-y-3 animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-rose-500 to-red-500 flex items-center justify-center shadow-xl shadow-rose-500/30">
                <Trash2 className="w-10 h-10 text-white" />
              </div>
              <div>
                <p className="font-black text-xl text-slate-900 dark:text-white">Biometric Removed</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  {staff.fullName}&apos;s biometric has been cleared. They will need to re-enroll.
                </p>
              </div>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Main camera / capture interface */}
          {!savedSuccess && !deletedSuccess && (
            <>
              {/* Webcam viewfinder */}
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950 border-2 border-emerald-500/30 shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${capturedPhoto ? "hidden" : "block"}`}
                />

                {capturedPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={capturedPhoto} alt="Captured biometric" className="w-full h-full object-cover" />
                )}

                {/* Oval face guide overlay */}
                {!capturedPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-60 rounded-[50%] border-2 border-dashed border-emerald-400/70 flex items-center justify-center relative">
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                    </div>
                  </div>
                )}

                {/* Status tag bottom */}
                <div className="absolute bottom-2 inset-x-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-[11px] font-mono text-center">
                  {extracting ? (
                    <span className="text-amber-300 flex items-center justify-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Extracting face descriptor...
                    </span>
                  ) : capturedPhoto ? (
                    faceQuality === "good" ? (
                      <span className="text-emerald-400 flex items-center justify-center gap-1.5">
                        <BadgeCheck className="w-3.5 h-3.5" /> Face detected — descriptor ready (128 points)
                      </span>
                    ) : faceQuality === "poor" ? (
                      <span className="text-amber-400 flex items-center justify-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> No face detected — image saved (recognition limited)
                      </span>
                    ) : null
                  ) : hasCamera ? (
                    <span className="text-emerald-400 flex items-center gap-1.5 justify-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Position face in oval &bull; Look directly at camera
                    </span>
                  ) : (
                    <span className="text-slate-400">Camera unavailable — upload a photo below</span>
                  )}
                </div>

                {/* Camera error overlay */}
                {hasCamera === false && !capturedPhoto && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 text-center p-6">
                    <Camera className="w-10 h-10 text-slate-500" />
                    <p className="text-xs text-slate-400 max-w-xs">{cameraError}</p>
                    <button
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> Retry Camera
                    </button>
                  </div>
                )}

                {/* Switch camera */}
                {!capturedPhoto && hasCamera && (
                  <button
                    type="button"
                    onClick={() => setFacingMode((p) => p === "user" ? "environment" : "user")}
                    className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/60 hover:bg-black/80 border border-white/10 text-white backdrop-blur-md transition-colors cursor-pointer"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Hidden canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Face quality notice */}
              {faceQuality === "poor" && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>No face descriptor could be extracted, so this photo cannot be enrolled. Retake or upload a clear photo showing {staff.fullName}&apos;s face.</span>
                </div>
              )}
              {faceQuality === "good" && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>This face will be enrolled only for {staff.fullName}. Each staff member must have their own face enrollment.</span>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {!capturedPhoto ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCapture}
                      disabled={!hasCamera}
                      className="py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Camera className="w-4 h-4" />
                      Capture Face
                    </button>

                    <label className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all">
                      <Upload className="w-4 h-4 text-emerald-500" />
                      Upload Photo
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRetake}
                      disabled={isSaving}
                      className="py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Retake
                    </button>

                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving || extracting || faceQuality !== "good"}
                      className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSaving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : (
                        <><ShieldCheck className="w-4 h-4" /> Save Biometric</>
                      )}
                    </button>
                  </div>
                )}

                {/* Delete biometric section */}
                {staff.hasBiometric && !capturedPhoto && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="w-full py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Biometric Data
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-center text-rose-600 dark:text-rose-400 font-semibold">
                          Are you sure? This removes all face recognition data for {staff.fullName}.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setConfirmDelete(false)}
                            className="py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-rose-600/25 cursor-pointer disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting...</>
                            ) : (
                              <><Trash2 className="w-3.5 h-3.5" /> Confirm Delete</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
