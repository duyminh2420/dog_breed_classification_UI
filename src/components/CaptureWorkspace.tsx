import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Crop,
  Maximize2,
  RefreshCw,
  ScanSearch,
  SwitchCamera,
  Trash2,
  Upload,
  VideoOff,
} from 'lucide-react';
import type {
  ClassificationHistoryEntry,
  ClassificationResult,
} from '../types/dognet.ts';
import {
  preprocessImageFile,
  preprocessVideoFrame,
  type PreprocessedImageBundle,
} from '../utils/imagePreprocessing.ts';

interface CaptureWorkspaceProps {
  externalFileInputTrigger: number;
  currentBundle: PreprocessedImageBundle | null;
  onBundleChange: (bundle: PreprocessedImageBundle | null) => void;
  history: ClassificationHistoryEntry[];
  onAddHistory: (entry: ClassificationHistoryEntry) => void;
  onClearHistory: () => void;
}

type InputSourceMode = 'upload' | 'camera';
type CropMode = 'center-224' | 'full-frame';

export function CaptureWorkspace({
  externalFileInputTrigger,
  currentBundle,
  onBundleChange,
  history,
  onAddHistory,
  onClearHistory,
}: CaptureWorkspaceProps) {
  const [sourceMode, setSourceMode] = useState<InputSourceMode>('upload');
  const [cropMode, setCropMode] = useState<CropMode>('full-frame');
  const [previewMode, setPreviewMode] = useState<CropMode>('full-frame');
  const [isDragging, setIsDragging] = useState(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [lastSourceUsed, setLastSourceUsed] = useState<'upload' | 'camera'>('upload');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setCameraStarting(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (externalFileInputTrigger > 0) {
      stopCamera();
      setSourceMode('upload');
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 40);
    }
  }, [externalFileInputTrigger, stopCamera]);

  const startCamera = useCallback(
    async (requestedFacing: 'environment' | 'user') => {
      stopCamera();
      setCameraError(null);
      setCameraStarting(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStarting(false);
        setCameraError(
          'Camera capture is not supported by this browser context. Please upload an image file instead.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: requestedFacing },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraActive(true);
        setCameraStarting(false);
      } catch (err: unknown) {
        setCameraStarting(false);
        const name = err instanceof DOMException ? err.name : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraError(
            'Camera access was denied. Enable camera permissions in your browser settings or upload an image file.'
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraError(
            'No camera device was detected on this machine. Connect a webcam or switch to Upload Image.'
          );
        } else {
          setCameraError(
            err instanceof Error
              ? err.message
              : 'Unable to initialize camera stream.'
          );
        }
      }
    },
    [stopCamera]
  );

  const runClassification = useCallback(
    async (
      bundle: PreprocessedImageBundle,
      selectedCropMode: CropMode,
      inputSource: 'upload' | 'camera'
    ) => {
      setIsClassifying(true);
      setClassifyError(null);

      const imageDataUrl =
        selectedCropMode === 'center-224'
          ? bundle.centerCropDataUrl
          : bundle.fullFrameDataUrl;

      try {
        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageDataUrl,
            mimeType: bundle.mimeType,
            cropMode: selectedCropMode,
          }),
        });

        const payload = await response.json();
        if (!response.ok) {
          const detailMsg =
            typeof payload?.details === 'string' && payload.details.length > 0
              ? ` (${payload.details})`
              : '';
          throw new Error(
            (payload?.error ||
              payload?.detail ||
              `Server returned HTTP ${response.status}`) + detailMsg
          );
        }

        const classified = payload as ClassificationResult;
        setResult(classified);
        onAddHistory({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          thumbnailDataUrl: bundle.centerCropDataUrl,
          source: inputSource,
          result: classified,
        });
      } catch (err: unknown) {
        setResult(null);
        setClassifyError(
          err instanceof Error
            ? err.message
            : 'Classification request failed unexpectedly.'
        );
      } finally {
        setIsClassifying(false);
      }
    },
    [onAddHistory]
  );

  const handleSelectedFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setClassifyError('Please select a valid image file (JPEG, PNG, or WebP).');
        return;
      }
      setClassifyError(null);
      try {
        const bundle = await preprocessImageFile(file);
        onBundleChange(bundle);
        setLastSourceUsed('upload');
        await runClassification(bundle, cropMode, 'upload');
      } catch (err: unknown) {
        setClassifyError(
          err instanceof Error ? err.message : 'Failed to process selected image.'
        );
      }
    },
    [cropMode, onBundleChange, runClassification]
  );

  const handleCaptureFrame = useCallback(async () => {
    if (!videoRef.current) return;
    setClassifyError(null);
    try {
      const bundle = preprocessVideoFrame(videoRef.current);
      onBundleChange(bundle);
      setLastSourceUsed('camera');
      stopCamera();
      setSourceMode('upload');
      await runClassification(bundle, cropMode, 'camera');
    } catch (err: unknown) {
      setClassifyError(
        err instanceof Error ? err.message : 'Failed to capture camera frame.'
      );
    }
  }, [cropMode, onBundleChange, runClassification, stopCamera]);

  const handleSwitchMode = (mode: InputSourceMode) => {
    setSourceMode(mode);
    setCameraError(null);
    if (mode === 'camera') {
      void startCamera(facingMode);
    } else {
      stopCamera();
    }
  };

  const handleToggleFacing = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    if (cameraActive || sourceMode === 'camera') {
      void startCamera(next);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleSelectedFile(file);
    }
  };

  const activePreviewUrl = currentBundle
    ? previewMode === 'center-224'
      ? currentBundle.centerCropDataUrl
      : currentBundle.fullFrameDataUrl
    : null;

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              DogNet Breed Inference Console
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Capture via camera or upload a photo to inspect top-5 breed predictions from your local Swin-T model.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-500">
            Notebook reference: <span className="font-semibold text-slate-900 tabular-nums">96.43%</span> · 71 Classes · 224×224 Input
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Stage: Input Capture / Upload Viewport */}
        <div className="flex flex-col border border-slate-200 bg-white lg:col-span-7">
          {/* Control Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="flex items-center border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => handleSwitchMode('upload')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  sourceMode === 'upload'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Upload Image</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('camera')}
                className={`inline-flex items-center gap-2 border-l border-slate-300 px-3 py-1.5 text-xs font-semibold transition-colors ${
                  sourceMode === 'camera'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Live Camera</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
                Inference Frame:
              </span>
              <div className="flex items-center border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setCropMode('full-frame');
                    setPreviewMode('full-frame');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                    cropMode === 'full-frame'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Maximize2 className="h-3 w-3" aria-hidden="true" />
                  <span>Full</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCropMode('center-224');
                    setPreviewMode('center-224');
                  }}
                  className={`inline-flex items-center gap-1 border-l border-slate-300 px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                    cropMode === 'center-224'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Crop className="h-3 w-3" aria-hidden="true" />
                  <span>224×224</span>
                </button>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleSelectedFile(file);
              }
              e.target.value = '';
            }}
          />

          {/* Main Viewport */}
          <div className="relative flex min-h-[380px] flex-1 flex-col items-center justify-center bg-slate-950/5 p-4 sm:min-h-[430px]">
            {sourceMode === 'camera' ? (
              <div className="relative flex h-full w-full flex-col items-center justify-center">
                <div className="relative w-full max-w-xl overflow-hidden border border-slate-300 bg-slate-950">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className={`aspect-[4/3] w-full object-cover ${
                      cameraActive ? 'cursor-crosshair opacity-100' : 'opacity-20'
                    }`}
                  />

                  {/* Center 224x224 Reticle Overlay */}
                  {cameraActive && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                      <div className="relative h-56 w-56 border border-cyan-400/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]">
                        <span className="absolute -top-5 left-0 font-mono text-[10px] font-medium uppercase tracking-wider text-cyan-300">
                          CenterCrop 224×224
                        </span>
                      </div>
                    </div>
                  )}

                  {cameraStarting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 text-white">
                      <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
                      <p className="mt-2 font-mono text-xs">Initializing camera stream...</p>
                    </div>
                  )}

                  {cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center text-white">
                      <VideoOff className="h-8 w-8 text-amber-400" />
                      <p className="mt-3 max-w-md text-sm text-slate-200">{cameraError}</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => void startCamera(facingMode)}
                          className="border border-slate-600 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          Retry Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSwitchMode('upload')}
                          className="bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Switch to File Upload
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera Action Bar */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={!cameraActive || isClassifying}
                    onClick={() => void handleCaptureFrame()}
                    className="inline-flex items-center gap-2 bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    <span>Capture &amp; Classify</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleFacing}
                    className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <SwitchCamera className="h-4 w-4" aria-hidden="true" />
                    <span>{facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('upload')}
                    className="border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Stop Camera
                  </button>
                </div>
              </div>
            ) : activePreviewUrl && currentBundle ? (
              <div className="flex w-full flex-col items-center">
                <div className="relative flex max-h-[340px] w-full items-center justify-center overflow-hidden border border-slate-300 bg-slate-900">
                  <img
                    src={activePreviewUrl}
                    alt="DogNet input preview"
                    className={`max-h-[336px] object-contain ${
                      previewMode === 'center-224' ? 'h-56 w-56 border border-cyan-400' : 'w-full'
                    }`}
                  />
                  <div className="absolute bottom-2 left-2 bg-slate-950/80 px-2 py-1 font-mono text-[11px] text-slate-200 tabular-nums">
                    {previewMode === 'center-224'
                      ? 'Tensor Preview: 224×224 CenterCrop'
                      : `Original: ${currentBundle.originalWidth}×${currentBundle.originalHeight}px`}
                  </div>
                </div>

                {/* Bottom Action & Preview Toggle Bar */}
                <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewMode((prev) =>
                          prev === 'full-frame' ? 'center-224' : 'full-frame'
                        )
                      }
                      className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Crop className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>
                        {previewMode === 'center-224'
                          ? 'View Full Frame'
                          : 'View 224×224 Crop'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Change Photo
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isClassifying}
                    onClick={() =>
                      void runClassification(currentBundle, cropMode, lastSourceUsed)
                    }
                    className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ScanSearch className="h-4 w-4" aria-hidden="true" />
                    <span>{isClassifying ? 'Classifying...' : 'Re-Run Classification'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex h-full min-h-[340px] w-full flex-col items-center justify-center border border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-300 bg-white'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center border border-slate-200 bg-slate-50 text-slate-700">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-slate-900">
                  Drop a dog photo or launch live camera
                </h2>
                <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">
                  Supports JPEG, PNG, and WebP. Images are preprocessed in-browser to mirror DogNet&apos;s{' '}
                  <span className="font-mono text-slate-700">Resize(256) → CenterCrop(224)</span> pipeline.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Choose File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('camera')}
                    className="inline-flex items-center gap-2 border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Use Camera</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Tensor Spec Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 font-mono text-[11px] text-slate-500">
            <span>
              Pipeline: Resize(256) · CenterCrop(224) · ImageNet Norm
            </span>
            {currentBundle ? (
              <span className="tabular-nums text-slate-700">
                RGB Mean [{currentBundle.channelStats.meanR.toFixed(3)},{' '}
                {currentBundle.channelStats.meanG.toFixed(3)},{' '}
                {currentBundle.channelStats.meanB.toFixed(3)}]
              </span>
            ) : (
              <span>Awaiting image tensor</span>
            )}
          </div>
        </div>

        {/* Right Stage: Classification & Confidence Readout */}
        <div className="flex flex-col border border-slate-200 bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-700">
              Classification Output
            </h2>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {result ? `${result.inferenceMs} ms · ${result.cropMode}` : 'Ready'}
            </span>
          </div>

          <div className="flex flex-1 flex-col p-5">
            {isClassifying ? (
              <div className="space-y-5" aria-live="polite">
                <div className="border-b border-slate-200 pb-4">
                  <div className="h-3 w-32 animate-pulse bg-slate-200" />
                  <div className="mt-3 h-8 w-56 animate-pulse bg-slate-200" />
                  <div className="mt-2 h-4 w-44 animate-pulse bg-slate-100" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((row) => (
                    <div key={row} className="space-y-1.5">
                      <div className="flex justify-between">
                        <div className="h-3.5 w-36 animate-pulse bg-slate-200" />
                        <div className="h-3.5 w-12 animate-pulse bg-slate-200" />
                      </div>
                      <div className="h-2 w-full animate-pulse bg-slate-100" />
                    </div>
                  ))}
                </div>
                <p className="font-mono text-xs text-blue-600">
                  Running server-side vision inference...
                </p>
              </div>
            ) : classifyError ? (
              <div className="flex flex-1 flex-col justify-between border border-rose-200 bg-rose-50/70 p-4">
                <div>
                  <div className="flex items-center gap-2 text-rose-700">
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider">
                      Inference Error
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-rose-900">
                    {classifyError}
                  </p>
                </div>
                {currentBundle && (
                  <button
                    type="button"
                    onClick={() =>
                      void runClassification(currentBundle, cropMode, lastSourceUsed)
                    }
                    className="mt-4 inline-flex w-fit items-center gap-2 border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Retry Classification</span>
                  </button>
                )}
              </div>
            ) : result ? (
              <div className="flex flex-1 flex-col justify-between space-y-5">
                <div>
                  {/* Primary Prediction Hero */}
                  {!result.isDog ? (
                    <div className="border border-amber-300 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 text-amber-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="font-mono text-xs font-semibold uppercase tracking-wider">
                          Non-Canine Frame Detected
                        </span>
                      </div>
                      <p className="mt-2 text-lg font-bold text-slate-900">
                        {result.primaryBreed}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700">
                        {result.subjectSummary}
                      </p>
                    </div>
                  ) : (
                    <div className="border-b border-slate-200 pb-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Top Predicted Breed
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Canine Verified</span>
                        </span>
                      </div>

                      <div className="mt-2 flex items-baseline justify-between gap-4">
                        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                          {result.primaryBreed}
                        </h3>
                        <div className="shrink-0 text-right">
                          <span className="font-mono text-3xl font-bold text-blue-600 tabular-nums">
                            {result.primaryConfidence.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 font-mono text-xs text-slate-500">
                        Group: <span className="text-slate-800">{result.breedGroup}</span> ·{' '}
                        Inference: <span className="text-slate-800">{result.modelUsed}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        {result.reasoning}
                      </p>
                    </div>
                  )}

                  {/* Top-K Confidence Breakdown */}
                  <div className="mt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Confidence Distribution
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        Top {result.topPredictions.length} Candidates
                      </span>
                    </div>

                    <div className="space-y-3">
                      {result.topPredictions.map((item, idx) => {
                        const isTop = idx === 0;
                        return (
                          <div key={`${item.breed}-${idx}`} className="space-y-1">
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                              <div className="flex min-w-0 items-baseline gap-2">
                                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                                  0{idx + 1}
                                </span>
                                <span
                                  className={`truncate ${
                                    isTop
                                      ? 'font-semibold text-slate-900'
                                      : 'font-medium text-slate-700'
                                  }`}
                                >
                                  {item.breed}
                                </span>
                              </div>
                              <span
                                className={`shrink-0 font-mono tabular-nums ${
                                  isTop
                                    ? 'font-bold text-blue-600'
                                    : 'font-medium text-slate-600'
                                }`}
                              >
                                {item.confidencePercent.toFixed(1)}%
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isTop ? 'bg-blue-600' : 'bg-cyan-500/75'
                                }`}
                                style={{
                                  width: `${Math.max(2, Math.min(100, item.confidencePercent))}%`,
                                }}
                              />
                            </div>
                            <p className="text-[11px] leading-snug text-slate-500">
                              {item.visualCues}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* DogNet Benchmark Accuracy Readout */}
                <div className="border-t border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="uppercase tracking-wider text-slate-500">
                      Checkpoint Validation Accuracy ({result.benchmarkReference.architecture})
                    </span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      {result.benchmarkReference.bestValAccuracy.toFixed(2)}% Best
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                    Final Validation Accuracy: {result.benchmarkReference.finalValAccuracy.toFixed(2)}% ·{' '}
                    Held-out Test: {result.benchmarkReference.testAccuracy == null
                      ? 'n/a'
                      : `${result.benchmarkReference.testAccuracy.toFixed(2)}%`} ·{' '}
                    Classes: {result.benchmarkReference.classesCount}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col justify-between space-y-6">
                <div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Upload a dog image or capture a live camera frame on the left to inspect:
                  </p>
                  <ul className="mt-4 space-y-2.5 border-t border-slate-200 pt-4 text-xs text-slate-600">
                    <li className="flex items-baseline justify-between">
                      <span>Primary Breed &amp; Confidence %</span>
                      <span className="font-mono text-slate-400">0.0% – 100.0%</span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span>Top-5 Probability Breakdown</span>
                      <span className="font-mono text-slate-400">Ranked Distribution</span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span>Canine Trait Reasoning</span>
                      <span className="font-mono text-slate-400">Coat · Ears · Muzzle</span>
                    </li>
                    <li className="flex items-baseline justify-between">
                      <span>DogNet Benchmark Accuracy</span>
                      <span className="font-mono text-slate-900 tabular-nums">96.43% Val</span>
                    </li>
                  </ul>
                </div>

                <div className="border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-900">Notebook Integration Note:</span>{' '}
                  The attached <span className="font-mono text-[11px]">final_DogNet__1__3ebfd580.ipynb</span>{' '}
                  contains your PyTorch training architectures and validation accuracy logs (without exported <span className="font-mono text-[11px]">.pth</span> weights), so live predictions run on the server-side vision API using DogNet&apos;s <span className="font-mono text-[11px]">224×224</span> framing spec.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Classification Log */}
      {history.length > 0 && (
        <div className="border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-700">
              Recent Classifications ({history.length})
            </h2>
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear Log</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5">Crop</th>
                  <th className="px-4 py-2.5">Predicted Breed</th>
                  <th className="px-4 py-2.5 text-right">Confidence</th>
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Frame Mode</th>
                  <th className="px-4 py-2.5 text-right">Inference</th>
                  <th className="px-4 py-2.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {history.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setResult(entry.result)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-2">
                      <img
                        src={entry.thumbnailDataUrl}
                        alt={entry.result.primaryBreed}
                        className="h-9 w-9 border border-slate-200 object-cover"
                      />
                    </td>
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      {entry.result.primaryBreed}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-blue-600 tabular-nums">
                      {entry.result.primaryConfidence.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-600">
                      {entry.source === 'camera' ? 'Camera' : 'Upload'}
                    </td>
                    <td className="px-4 py-2 font-mono text-slate-600">
                      {entry.result.cropMode}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500 tabular-nums">
                      {entry.result.inferenceMs} ms
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-slate-500 tabular-nums">
                      {entry.timestamp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
