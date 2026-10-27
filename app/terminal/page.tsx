"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/Toast";
import { ShieldAlert } from "lucide-react";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Fingerprint,
  MonitorPlay,
  Wifi,
  Clock,
  SwitchCamera,
  Upload,
  RotateCcw,
  XCircle,
  Loader2,
  Scan,
  UserCheck,
  Smile,
  Brain
} from "lucide-react";

// Dynamically import face-api to avoid SSR issues
let faceapi: any = null;
let modelsLoaded = false;
let modelsLoading = false;

async function loadFaceApiModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelsLoading) {
    // Wait until loaded
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
    console.log("[face-api] Models loaded successfully");
    return true;
  } catch (err) {
    console.error("[face-api] Failed to load models:", err);
    modelsLoading = false;
    return false;
  }
}

/**
 * Extract 128-point face descriptor from a video element using face-api.js.
 * Returns null if no face is detected.
 */
async function extractFaceDescriptor(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement
): Promise<{ descriptor: number[]; confidence: number } | null> {
  if (!faceapi || !modelsLoaded) return null;
  try {
    const detection = await faceapi
      .detectSingleFace(videoOrCanvas, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    return {
      descriptor: Array.from(detection.descriptor as Float32Array),
      confidence: detection.detection.score
    };
  } catch (err) {
    console.warn("[face-api] Detection error:", err);
    return null;
  }
}

/**
 * Extract robust 64-block perceptual luminance & 56-bit dHash & color profile from canvas.
 * Instantaneous, pure-JS canvas operation that NEVER fails.
 */
function extractCanvasVisualFeatures(canvas: HTMLCanvasElement): {
  dhash: string;
  blocks: number[];
  color: [number, number, number];
} {
  try {
    const size = 32;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = size;
    tempCanvas.height = size;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) {
      return { dhash: "1".repeat(56), blocks: Array(64).fill(128), color: [128, 128, 128] };
    }

    ctx.drawImage(canvas, 0, 0, size, size);
    const imgData = ctx.getImageData(0, 0, size, size).data;

    // 8x8 luminance blocks (64 values)
    const blocks: number[] = [];
    const blockSize = 4;
    for (let by = 0; by < 8; by++) {
      for (let bx = 0; bx < 8; bx++) {
        let sum = 0;
        for (let y = 0; y < blockSize; y++) {
          for (let x = 0; x < blockSize; x++) {
            const px = ((by * blockSize + y) * size + (bx * blockSize + x)) * 4;
            const r = imgData[px];
            const g = imgData[px + 1];
            const b = imgData[px + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            sum += lum;
          }
        }
        blocks.push(Math.round(sum / (blockSize * blockSize)));
      }
    }

    // 56-bit dHash
    let dhash = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 7; x++) {
        const left = blocks[y * 8 + x];
        const right = blocks[y * 8 + x + 1];
        dhash += left > right ? "1" : "0";
      }
    }

    // Average color profile
    let totalR = 0, totalG = 0, totalB = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      totalR += imgData[i];
      totalG += imgData[i + 1];
      totalB += imgData[i + 2];
    }
    const pixelCount = imgData.length / 4;
    const avgR = Math.round(totalR / pixelCount);
    const avgG = Math.round(totalG / pixelCount);
    const avgB = Math.round(totalB / pixelCount);

    return { dhash, blocks, color: [avgR, avgG, avgB] };
  } catch (err) {
    console.warn("Visual feature extraction error:", err);
    return { dhash: "1".repeat(56), blocks: Array(64).fill(128), color: [128, 128, 128] };
  }
}

/**
 * Checks for human face/skin presence in video stream (fast, reliable).
 */
async function detectFacePresence(video: HTMLVideoElement): Promise<boolean> {
  if (video.readyState < 2 || video.videoWidth === 0) return false;

  // 1. Try face-api TinyFaceDetector if loaded
  if (faceapi && modelsLoaded) {
    try {
      const detection = await faceapi.detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.35 })
      );
      if (detection) return true;
    } catch {
      // Fallback to center-oval skin detection
    }
  }

  // 2. Optical skin-tone presence fallback in central region
  try {
    const tempCanvas = document.createElement("canvas");
    const w = 36;
    const h = 36;
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return false;

    const sx = video.videoWidth * 0.25;
    const sy = video.videoHeight * 0.2;
    const sw = video.videoWidth * 0.5;
    const sh = video.videoHeight * 0.6;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h).data;

    let skinPixels = 0;
    const total = w * h;
    for (let i = 0; i < imgData.length; i += 4) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      if (r > 40 && g > 25 && b > 15 && r > g && r > b && (r - b) > 10) {
        skinPixels++;
      }
    }
    return (skinPixels / total) >= 0.22;
  } catch {
    return false;
  }
}

export default function TerminalPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Terminal States
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [isProcessing, setIsProcessing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [lockProgress, setLockProgress] = useState(0);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "locking" | "processing">("idle");

  // Success state for existing staff
  const [verifiedSuccess, setVerifiedSuccess] = useState<any | null>(null);
  const [countdown, setCountdown] = useState<number>(5);

  // State for unrecognised face rejection screen
  const [notRecognised, setNotRecognised] = useState(false);

  // Live Clock & Hydration
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(() => new Date());

  const { success: toastSuccess, error: toastError } = useToast();

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load face-api models on mount
  useEffect(() => {
    loadFaceApiModels().then((ok) => {
      setModelsReady(ok);
      if (!ok) setModelLoadError(true);
    });
  }, []);

  const timeStr = mounted
    ? time.toLocaleTimeString("en-GH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      })
    : "--:--:--";

  // Audio feedback helper
  const playSound = useCallback((type: "shutter" | "success" | "lock" | "new" | "click") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (type === "shutter") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(950, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === "lock") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(750, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "success") {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
          gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.07 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.07);
          osc.stop(ctx.currentTime + idx * 0.07 + 0.3);
        });
      } else if (type === "new") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch {
      // Audio not supported or blocked
    }
  }, []);

  /**
   * Speak a message aloud using the Web Speech API (SpeechSynthesis).
   * Picks the best available English voice automatically.
   * Silently fails on browsers that don't support speech synthesis.
   */
  const speak = useCallback((message: string, delayMs = 0) => {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      const fire = () => {
        // Cancel any ongoing speech first
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 0.95;   // Slightly slower — clear and deliberate
        utterance.pitch = 1.05;  // Slightly warm, not robotic
        utterance.volume = 1;

        // Prefer a natural English voice (en-GH or en-GB or en-US)
        const voices = window.speechSynthesis.getVoices();
        const preferred =
          voices.find((v) => v.lang === "en-GH") ||
          voices.find((v) => v.lang.startsWith("en-GB")) ||
          voices.find((v) => v.lang.startsWith("en-US") && v.localService) ||
          voices.find((v) => v.lang.startsWith("en"));

        if (preferred) utterance.voice = preferred;
        window.speechSynthesis.speak(utterance);
      };

      if (delayMs > 0) {
        setTimeout(fire, delayMs);
      } else {
        // Voices may not be loaded yet on first run — small safety wait
        if (window.speechSynthesis.getVoices().length === 0) {
          window.speechSynthesis.onvoiceschanged = () => { fire(); window.speechSynthesis.onvoiceschanged = null; };
        } else {
          fire();
        }
      }
    } catch {
      // Speech synthesis not supported — fail silently
    }
  }, []);

  // Stop camera media tracks safely
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Start webcam video stream immediately on load
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Webcam is not supported in this browser.");
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
      console.warn("Camera init warning:", err);
      setHasCamera(false);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera permissions in your browser."
          : "Webcam not detected or unavailable."
      );
    }
  }, [facingMode, stopCamera]);

  // Launch camera immediately on page load
  useEffect(() => {
    if (!verifiedSuccess && !notRecognised) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera, verifiedSuccess, notRecognised]);

  // Reset back to live camera view
  const handleResetToCamera = useCallback(() => {
    setVerifiedSuccess(null);
    setNotRecognised(false);
    setIsProcessing(false);
    setFaceDetected(false);
    setLockProgress(0);
    setScanStatus("idle");
    startCamera();
  }, [startCamera]);

  // Auto-reset countdown when existing staff attendance is recorded
  useEffect(() => {
    if (!verifiedSuccess) return;

    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleResetToCamera();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [verifiedSuccess, handleResetToCamera]);

  // Capture frame to canvas and return data URL
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  }, []);

  // Execute Biometric Verification with face-api.js 128-point descriptor
  const executeBiometricVerification = useCallback(async (photoDataUrl: string, features: any) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setScanStatus("processing");

    try {
      const res = await fetch("/api/staff/biometric-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biometricImage: photoDataUrl,
          faceFeatures: features,
          action: "CHECK_IN",
          location: "DVLA Official Terminal, Cantonments"
        })
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch (parseErr) {
        console.warn("Failed parsing verification response:", parseErr);
        data = { success: false, isNewStaff: true };
      }

      setIsProcessing(false);
      setScanStatus("idle");

      if (res.ok && data.success) {
        // Attendance action succeeded (CHECK_IN or CHECK_OUT)
        playSound("success");
        stopCamera();
        setVerifiedSuccess(data);

        if (data.action === "CHECK_OUT") {
          toastSuccess(`Goodbye, ${data.staff.fullName}! Check-out recorded.`);
        } else {
          toastSuccess(`Thank you, ${data.staff.fullName}! Attendance recorded.`);
        }
        speak("Thank you", 350);
      } else if (data.alreadyCheckedIn) {
        // Attendance already taken today, before 5:00 PM checkout
        playSound("click");
        stopCamera();
        setVerifiedSuccess({ ...data, isInfo: true });
        toastSuccess(`Already checked in today at ${data.attendance?.checkInTime}.`);
        speak("Already checked in", 350);
      } else if (data.alreadyCompleted) {
        // Both check-in and check-out completed for today
        playSound("click");
        stopCamera();
        setVerifiedSuccess({ ...data, isInfo: true, isComplete: true });
        toastSuccess(`Attendance already completed for today.`);
        speak("Attendance already completed", 350);
      } else if (data.isOnLeave) {
        playSound("click");
        stopCamera();
        setVerifiedSuccess({ ...data, isInfo: true, isOnLeave: true });
        speak("On approved leave today", 350);
      } else {
        // FACE NOT RECOGNISED — show rejection screen
        playSound("new");
        stopCamera();
        setNotRecognised(true);
        speak("Sorry, not recognised", 300);
        // Auto-reset after 6 seconds
        setTimeout(() => {
          setNotRecognised(false);
          setIsProcessing(false);
          setFaceDetected(false);
          setLockProgress(0);
          setScanStatus("idle");
        }, 6000);
      }
    } catch (err: any) {
      console.error("Verification network error:", err);
      setIsProcessing(false);
      setScanStatus("idle");
      // Network error — show rejection screen
      playSound("new");
      stopCamera();
      setNotRecognised(true);
      speak("Sorry, not recognised", 300);
      setTimeout(() => {
        setNotRecognised(false);
        setIsProcessing(false);
        setFaceDetected(false);
        setLockProgress(0);
        setScanStatus("idle");
      }, 6000);
    }
  }, [isProcessing, playSound, speak, stopCamera, toastSuccess]);

  // CONTINUOUS AUTOMATIC FACE DETECTION LOOP using face-api.js
  useEffect(() => {
    if (!autoScanEnabled || verifiedSuccess || notRecognised || hasCamera !== true || !modelsReady) {
      return;
    }

    let lockCounter = 0;
    let scanning = true;
    let running = true;

    const runLoop = async () => {
      while (running && scanning) {
        await new Promise((r) => setTimeout(r, 400)); // Check every 400ms
        if (!running || !scanning) break;

        const video = videoRef.current;
        if (!video || video.readyState < 2 || video.videoWidth === 0) continue;

        const facePresent = await detectFacePresence(video);

        if (!running || !scanning) break;

        if (facePresent) {
          lockCounter += 1;
          setFaceDetected(true);
          setScanStatus("locking");
          // Lock progress fills over 3 ticks (~1.2s) for stability
          setLockProgress(Math.min(100, Math.round((lockCounter / 3) * 100)));

          if (lockCounter === 1) {
            playSound("lock");
          }

          // After 3 consecutive detections (~1.2s), fire automatic capture
          if (lockCounter >= 3) {
            scanning = false;
            setLockProgress(100);

            // Short delay so user sees 100% before capture fires
            await new Promise((r) => setTimeout(r, 150));
            if (!running) break;

            const video2 = videoRef.current;
            const canvas2 = canvasRef.current;
            if (!video2 || !canvas2) break;

            // Capture frame
            canvas2.width = video2.videoWidth || 640;
            canvas2.height = video2.videoHeight || 480;
            const ctx2 = canvas2.getContext("2d");
            if (!ctx2) break;
            ctx2.drawImage(video2, 0, 0, canvas2.width, canvas2.height);
            const dataUrl = canvas2.toDataURL("image/jpeg", 0.88);

            playSound("shutter");

            // Extract both visual perceptual features and 128-point face descriptor
            const visualFeatures = extractCanvasVisualFeatures(canvas2);
            let descriptor: number[] | undefined = undefined;
            try {
              let result = await extractFaceDescriptor(canvas2);
              if (!result?.descriptor) {
                result = await extractFaceDescriptor(video2);
              }
              if (result?.descriptor) {
                descriptor = result.descriptor;
              }
            } catch (err) {
              console.warn("Descriptor extraction error:", err);
            }

            const features = {
              ...visualFeatures,
              descriptor
            };

            await executeBiometricVerification(dataUrl, features);
            break;
          }
        } else {
          // Face left frame — decay counter
          lockCounter = Math.max(0, lockCounter - 1);
          if (lockCounter === 0) {
            setFaceDetected(false);
            setScanStatus("idle");
          }
          setLockProgress(Math.round((lockCounter / 3) * 100));
        }
      }
    };

    runLoop();

    return () => {
      running = false;
      scanning = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoScanEnabled, hasCamera, verifiedSuccess, notRecognised, modelsReady]);

  // Switch between front/back camera
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const scanStatusLabel = () => {
    if (!modelsReady) return "Loading AI models...";
    if (isProcessing || scanStatus === "processing") return "Verifying identity...";
    if (scanStatus === "locking" || faceDetected) return "Face detected — hold still";
    return "Align face inside the oval guide";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 text-white flex flex-col">
      {/* Hidden processing canvases */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Status Bar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 bg-black/40 border-b border-emerald-500/20 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <MonitorPlay className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-black tracking-widest text-emerald-300 uppercase">
              DVLA Biometric Terminal
            </p>
            <p className="text-[10px] text-slate-400">
              AI Face Recognition Attendance &bull; Cantonments, Accra
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono bg-white/5 border border-white/10 px-3 py-1 rounded-full">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{timeStr}</span>
          </div>
        </div>
      </header>

      {/* Main Terminal Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 max-w-4xl mx-auto w-full">
        {/* CASE 0: FACE NOT RECOGNISED — REJECTION SCREEN */}
        {notRecognised ? (
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-500/20 text-center animate-in zoom-in-95 duration-300 space-y-6">
            {/* Pulsing red X circle */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-rose-500/25 animate-ping" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 flex items-center justify-center text-white shadow-2xl shadow-rose-500/60">
                <XCircle className="w-14 h-14 stroke-[2]" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-rose-300 bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5" /> Face Not Recognised
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-white pt-2">
                Sorry!
              </h1>
              <p className="text-xl font-bold text-rose-400">
                Not Recognised
              </p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Your face does not match any registered staff in the DVLA system.
                Please contact your administrator to enroll your biometric data.
              </p>
            </div>

            {/* Info box */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-xs space-y-2 text-left">
              <div className="flex items-start gap-2 text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-slate-300">
                  Only staff whose biometrics have been enrolled by an <span className="text-amber-300 font-semibold">Administrator</span> can be recognised at this terminal.
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-400">
                Returning to scanner in <span className="text-rose-400 font-bold font-mono">a few seconds...</span>
              </p>
              <button
                type="button"
                onClick={handleResetToCamera}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        ) : verifiedSuccess ? (
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/20 text-center animate-in zoom-in-95 duration-300 space-y-6">
            {/* Glowing icon circle */}
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full animate-ping ${verifiedSuccess.alreadyCheckedIn ? "bg-amber-500/25" : "bg-emerald-500/25"}`} />
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white shadow-2xl ${
                verifiedSuccess.alreadyCheckedIn
                  ? "bg-gradient-to-tr from-amber-500 to-yellow-400 shadow-amber-500/60"
                  : verifiedSuccess.action === "CHECK_OUT"
                  ? "bg-gradient-to-tr from-teal-500 to-cyan-400 shadow-teal-500/60"
                  : "bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-emerald-500/60"
              }`}>
                {verifiedSuccess.alreadyCheckedIn ? (
                  <Clock className="w-13 h-13 stroke-[2.5]" />
                ) : (
                  <CheckCircle2 className="w-14 h-14 stroke-[2.5]" />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full border ${
                verifiedSuccess.alreadyCheckedIn
                  ? "text-amber-300 bg-amber-500/20 border-amber-500/40"
                  : verifiedSuccess.alreadyCompleted
                  ? "text-cyan-300 bg-cyan-500/20 border-cyan-500/40"
                  : verifiedSuccess.action === "CHECK_OUT"
                  ? "text-teal-300 bg-teal-500/20 border-teal-500/40"
                  : "text-emerald-300 bg-emerald-500/20 border-emerald-500/40"
              }`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {verifiedSuccess.alreadyCheckedIn
                  ? "Attendance Already Taken Today"
                  : verifiedSuccess.alreadyCompleted
                  ? "Day Complete — Attendance Finished"
                  : verifiedSuccess.action === "CHECK_OUT"
                  ? "Check-Out Complete (5:00 PM)"
                  : "Attendance Check-In Recorded"}
              </span>

              <h1 className="text-3xl sm:text-4xl font-black text-white pt-2">
                {verifiedSuccess.alreadyCheckedIn
                  ? "Already Checked In"
                  : verifiedSuccess.alreadyCompleted
                  ? "Attendance Finished"
                  : verifiedSuccess.action === "CHECK_OUT"
                  ? "Safe Journey!"
                  : "Attendance Recorded!"}
              </h1>

              <p className="text-xl font-bold text-emerald-400">
                {verifiedSuccess.staff?.fullName}
              </p>

              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {verifiedSuccess.message ||
                  "Your face was recognized and attendance has been processed in official DVLA records."}
              </p>
            </div>

            {/* Attendance Details Box */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-xs space-y-2.5 text-left font-mono">
              <div className="flex justify-between items-center text-slate-400">
                <span>Staff ID:</span>
                <span className="text-white font-bold">{verifiedSuccess.staff?.staffId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Department:</span>
                <span className="text-slate-200 font-medium">{verifiedSuccess.staff?.department}</span>
              </div>
              {verifiedSuccess.attendance?.checkInTime && (
                <div className="flex justify-between items-center text-slate-400">
                  <span>Check-In Time:</span>
                  <span className="text-emerald-400 font-bold">{verifiedSuccess.attendance?.checkInTime}</span>
                </div>
              )}
              {verifiedSuccess.attendance?.time && !verifiedSuccess.attendance?.checkInTime && (
                <div className="flex justify-between items-center text-slate-400">
                  <span>Punch Time:</span>
                  <span className="text-emerald-400 font-bold">{verifiedSuccess.attendance?.time}</span>
                </div>
              )}
              {verifiedSuccess.attendance?.checkOutTime && (
                <div className="flex justify-between items-center text-slate-400">
                  <span>Check-Out Time:</span>
                  <span className="text-cyan-400 font-bold">{verifiedSuccess.attendance?.checkOutTime}</span>
                </div>
              )}
              {verifiedSuccess.attendance?.formattedDuration && (
                <div className="flex justify-between items-center text-slate-400">
                  <span>Total Logged Hours:</span>
                  <span className="text-white font-bold">{verifiedSuccess.attendance?.formattedDuration}</span>
                </div>
              )}
              {verifiedSuccess.alreadyCheckedIn && (
                <div className="flex justify-between items-center text-slate-400">
                  <span>Check-Out Opens:</span>
                  <span className="text-amber-400 font-bold">05:00 PM (17:00)</span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-400">
                <span>Status:</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  verifiedSuccess.alreadyCheckedIn
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}>
                  {verifiedSuccess.alreadyCheckedIn
                    ? "CHECKED IN (IN PROGRESS)"
                    : verifiedSuccess.attendance?.status || "PRESENT"}
                </span>
              </div>
              {verifiedSuccess.matchConfidence && (
                <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Face Recognition:</span>
                  <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> {verifiedSuccess.matchConfidence}% Match
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-200/90 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>No buttons clicked &bull; No forms required.</span>
            </div>

            {/* Countdown & Reset Button */}
            <div className="space-y-3 pt-1">
              <p className="text-xs text-slate-400">
                Next staff auto-scan resumes in <span className="text-emerald-400 font-bold font-mono">{countdown}s</span>
              </p>
              <button
                type="button"
                onClick={handleResetToCamera}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Scan Next Staff Member</span>
              </button>
            </div>
          </div>
        ) : (
          /* CASE 2: LIVE AUTOMATIC CONTACTLESS SCANNING VIEWPORT */
          <div className="w-full max-w-xl flex flex-col items-center space-y-5">
            {/* Terminal Title */}
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 rounded-full">
                <Fingerprint className="w-3.5 h-3.5" />
                <span>AI Biometric Terminal</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Automatic Staff Attendance
              </h1>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Look directly into the camera. The AI detects your face and records attendance automatically. Only pre-enrolled staff will be recognised.
              </p>
            </div>

            {/* AI Model Loading Banner */}
            {!modelsReady && !modelLoadError && (
              <div className="w-full max-w-md flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                <Brain className="w-5 h-5 shrink-0 animate-pulse" />
                <div>
                  <p className="font-bold">Loading AI face recognition models...</p>
                  <p className="text-amber-400/70 mt-0.5">This takes a few seconds on first load</p>
                </div>
              </div>
            )}
            {modelLoadError && (
              <div className="w-full max-w-md flex items-center gap-3 p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">AI model load failed.</p>
                  <p className="text-red-400/70 mt-0.5">Use manual capture or upload photo below.</p>
                </div>
              </div>
            )}

            {/* WEBCAM VIEWFINDER CARD */}
            <div className="relative w-full max-w-md aspect-[4/3] rounded-3xl overflow-hidden bg-slate-950 border-2 border-emerald-500/30 shadow-2xl shadow-emerald-500/15 flex items-center justify-center">
              {/* Active Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* High-tech Face Alignment Guide (Oval frame) */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`relative w-44 sm:w-52 h-56 sm:h-64 rounded-[50%] border-2 transition-all duration-300 flex items-center justify-center ${
                    faceDetected
                      ? "border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.5)] scale-105"
                      : "border-dashed border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  }`}
                >
                  {/* Corner Target Markers */}
                  <div className={`absolute w-4 h-4 border-t-2 border-l-2 transition-colors ${faceDetected ? "border-emerald-300" : "border-emerald-500/50"} -top-1 -left-1`} />
                  <div className={`absolute w-4 h-4 border-t-2 border-r-2 transition-colors ${faceDetected ? "border-emerald-300" : "border-emerald-500/50"} -top-1 -right-1`} />
                  <div className={`absolute w-4 h-4 border-b-2 border-l-2 transition-colors ${faceDetected ? "border-emerald-300" : "border-emerald-500/50"} -bottom-1 -left-1`} />
                  <div className={`absolute w-4 h-4 border-b-2 border-r-2 transition-colors ${faceDetected ? "border-emerald-300" : "border-emerald-500/50"} -bottom-1 -right-1`} />

                  {/* Scanning beam animation */}
                  {isProcessing ? (
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-bounce" />
                  ) : faceDetected ? (
                    <div className="absolute inset-x-0 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_#34d399] animate-pulse" />
                  ) : null}
                </div>
              </div>

              {/* Corner Overlays: Status badges */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE CAMERA</span>
              </div>

              <div className="absolute top-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Switch camera"
                >
                  <SwitchCamera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Real-time Face Auto-Lock Banner */}
              <div className="absolute bottom-3 inset-x-3 p-3 rounded-2xl bg-black/80 backdrop-blur-md border border-emerald-500/40 text-center space-y-1.5 transition-all">
                {isProcessing ? (
                  <div className="flex items-center justify-center gap-2 text-xs font-mono text-emerald-300 py-1">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Verifying Identity in DVLA Records...</span>
                  </div>
                ) : faceDetected ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Smile className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        FACE DETECTED &mdash; HOLD STILL
                      </span>
                      <span>{lockProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150"
                        style={{ width: `${lockProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-slate-300 py-1">
                    <Scan className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>{scanStatusLabel()}</span>
                  </div>
                )}
              </div>

              {/* Warning overlay if webcam is blocked or not detected */}
              {hasCamera === false && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-amber-400" />
                  <p className="text-xs text-slate-300 max-w-xs">
                    {cameraError || "Webcam stream is inactive. You can use test capture below."}
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry Camera
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* No self-enrollment form — admin-only enrollment enforced */}
    </div>
  );
}
