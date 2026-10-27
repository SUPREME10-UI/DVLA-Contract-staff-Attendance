"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Sparkles,
  User,
  ArrowRight,
  Loader2,
  SwitchCamera,
  Upload
} from "lucide-react";
import { extractCanvasVisualFeatures } from "@/lib/face-matcher";

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

interface BiometricWebcamModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffIdentifier?: string; // Pre-filled or entered ID/email
  isNewStaffFlow?: boolean; // Forced new staff flow
  onExistingSuccess?: (staff: any, attendance: any) => void;
  onNewStaffCaptured?: (biometricPhoto: string, identifier?: string, features?: any) => void;
  title?: string;
  subtitle?: string;
}

export function BiometricWebcamModal({
  isOpen,
  onClose,
  staffIdentifier = "",
  isNewStaffFlow = false,
  onExistingSuccess,
  onNewStaffCaptured,
  title = "Biometric Face Verification",
  subtitle = "Align your face within the frame to verify identity"
}: BiometricWebcamModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [localIdentifier, setLocalIdentifier] = useState(staffIdentifier);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Stop camera media tracks safely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start webcam video stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam API is not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setHasCamera(true);
    } catch (err: any) {
      console.warn("Camera init error, offering fallback options:", err);
      setHasCamera(false);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera permissions in your browser or use simulated capture below."
          : "Webcam not detected or unavailable. You can use sample biometric capture below."
      );
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setCapturedPhoto(null);
      setIsSuccess(false);
      setSuccessData(null);
      setScanProgress(0);
      setLocalIdentifier(staffIdentifier);
      setVerificationError(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera, staffIdentifier]);

  // Audio beep feedback using Web Audio API
  const playBeep = (freq = 880, type: OscillatorType = "sine", duration = 0.15) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio not permitted or supported
    }
  };

  // Capture frame from <video> onto <canvas>
  const handleCaptureSnapshot = async () => {
    playBeep(920, "triangle", 0.1);
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
        setCapturedPhoto(dataUrl);

        const visualFeatures = extractCanvasVisualFeatures(canvas);
        const desc = await extractFaceDescriptor(canvas);
        const features = {
          ...visualFeatures,
          descriptor: desc || undefined
        };
        processBiometricPhoto(dataUrl, features);
      }
    }
  };

  // Handle uploaded photo fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const img = new Image();
        img.onload = async () => {
          const canvas = canvasRef.current || document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const visualFeatures = extractCanvasVisualFeatures(canvas);
            const desc = await extractFaceDescriptor(canvas);
            const features = {
              ...visualFeatures,
              descriptor: desc || undefined
            };
            setCapturedPhoto(result);
            processBiometricPhoto(result, features);
          }
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Process biometric photo: Check if staff is new vs existing
  const processBiometricPhoto = async (photoDataUrl: string, features?: any) => {
    setVerificationError(null);
    setIsScanning(true);
    setScanProgress(20);

    const scanInterval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 90) {
          clearInterval(scanInterval);
          return 90;
        }
        return prev + 25;
      });
    }, 150);

    setTimeout(async () => {
      clearInterval(scanInterval);
      setScanProgress(100);
      setIsScanning(false);

      // If user specifically requested new staff flow, advance directly to form
      if (isNewStaffFlow) {
        playBeep(1040, "sine", 0.2);
        stopCamera();
        if (onNewStaffCaptured) {
          onNewStaffCaptured(photoDataUrl, localIdentifier, features);
        }
        return;
      }

      // Check whether this staff is existing in database
      setIsVerifying(true);
      try {
        const verifyRes = await fetch("/api/staff/biometric-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: localIdentifier || staffIdentifier,
            biometricImage: photoDataUrl,
            faceFeatures: features,
            action: "CHECK_IN",
            location: "DVLA Official Terminal, Cantonments"
          })
        });

        const verifyData = await verifyRes.json();

        if (verifyRes.ok && verifyData.success) {
          // Existing staff verified! Show "Thank you" with green correct mark
          playBeep(1200, "triangle", 0.25);
          setIsSuccess(true);
          setSuccessData(verifyData);
          if (onExistingSuccess) {
            onExistingSuccess(verifyData.staff, verifyData.attendance);
          }
        } else {
          setVerificationError(
            verifyData.message || verifyData.error || "Sorry, your face was not recognised. Please contact an administrator to enroll your biometric."
          );
          setCapturedPhoto(null);
        }
      } catch (err) {
        console.error("Biometric verification error:", err);
        setVerificationError("Biometric verification is unavailable right now. Please try again.");
        setCapturedPhoto(null);
      } finally {
        setIsVerifying(false);
      }
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                DVLA Web Attendance • Real-Time Face Biometrics
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {/* STATE A: SUCCESS CELEBRATION ("THANK YOU" WITH CORRECT MARK IN GREEN) */}
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300">
              {/* Correct mark in green with glowing animated ripples */}
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-emerald-500/20 animate-ping absolute" />
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 z-10">
                  <CheckCircle2 className="w-14 h-14 stroke-[2.5]" />
                </div>
              </div>

              {/* Thank you message */}
              <div className="space-y-1">
                <span className="text-xs uppercase font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
                  Biometric Verified
                </span>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white pt-2">
                  Thank You!
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                  Welcome back, <span className="font-bold text-emerald-600 dark:text-emerald-400">{successData?.staff?.fullName || "Staff Member"}</span>
                </p>
              </div>

              {/* Verification Details Box */}
              <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 text-xs space-y-2 text-left">
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Staff ID:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {successData?.staff?.staffId}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Department:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {successData?.staff?.department}
                  </span>
                </div>
                {successData?.attendance && (
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400">Attendance Logged:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {successData.attendance.time} ({successData.attendance.status})
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                  if (typeof window !== "undefined") {
                    window.location.href = successData?.redirectUrl || "/staff/dashboard";
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>Enter Staff Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* STATE B: LIVE WEBCAM & CAPTURE INTERFACE */
            <div className="space-y-4">
              {/* Optional Identifier Input if not passed */}
              {!staffIdentifier && !isNewStaffFlow && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Staff ID or Email (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DVLA-CS-001 or leave blank for new staff"
                    value={localIdentifier}
                    onChange={(e) => setLocalIdentifier(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Live Camera Viewfinder */}
              <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-slate-950 border-2 border-emerald-500/40 shadow-inner flex items-center justify-center">
                {/* Real Video Element */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${
                    capturedPhoto ? "hidden" : "block"
                  }`}
                />

                {/* Captured Photo Preview */}
                {capturedPhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={capturedPhoto}
                    alt="Captured biometric preview"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Scanner Overlay HUD */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                  {/* Oval face guide */}
                  <div
                    className={`w-52 h-64 rounded-[48%] border-2 ${
                      isScanning || isVerifying
                        ? "border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.5)]"
                        : "border-white/60 border-dashed"
                    } flex items-center justify-center relative transition-all duration-300`}
                  >
                    {/* Laser scanning beam animation */}
                    {(isScanning || isVerifying) && (
                      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#10b981] animate-bounce w-full" />
                    )}

                    {/* Corner Target Markers */}
                    <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                    <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
                  </div>

                  {/* Live Status Tag */}
                  <div className="absolute bottom-3 bg-slate-900/85 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/40 text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5 shadow-md">
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>Verifying Biometric Neural Match...</span>
                      </>
                    ) : isScanning ? (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>Scanning Facial Points ({scanProgress}%)...</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Position face in oval • Look directly at camera</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Flip camera button */}
                <button
                  type="button"
                  onClick={() => {
                    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
                  }}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-slate-900/70 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700 transition-all cursor-pointer"
                  title="Switch camera"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              </div>

              {/* Hidden canvas for image capture */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Camera Error / Fallback alert if camera is missing */}
              {cameraError && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Camera Notification</span>
                  </div>
                  <p className="text-[11px] opacity-90">{cameraError}</p>
                </div>
              )}

              {verificationError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold">
                  {verificationError}
                </div>
              )}

              {/* Camera Controls & Trigger Buttons */}
              <div className="space-y-2 pt-1">
                {!capturedPhoto ? (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={handleCaptureSnapshot}
                      disabled={isScanning || isVerifying}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Biometric Snapshot</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedPhoto(null);
                        startCamera();
                      }}
                      disabled={isScanning || isVerifying}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Retake Photo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => processBiometricPhoto(capturedPhoto)}
                      disabled={isScanning || isVerifying}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Confirm & Process</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Upload custom picture link */}
                <div className="flex items-center justify-center pt-1 text-slate-500 dark:text-slate-400 text-[11px] gap-1">
                  <Upload className="w-3 h-3" />
                  <span>Or</span>
                  <label className="text-emerald-600 dark:text-emerald-400 font-semibold cursor-pointer hover:underline">
                    upload photo from device
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
