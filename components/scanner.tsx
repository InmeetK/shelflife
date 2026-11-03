"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "starting" | "scanning" | "unavailable";

/**
 * Rear camera → barcode-detector ponyfill (ZXing WASM). Decoded codes go to
 * `onDetected`, the same handler manual entry uses. Tracks stop on unmount.
 */
export function Scanner({ onDetected, paused }: { onDetected: (code: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const pausedRef = useRef(paused);
  const [status, setStatus] = useState<Status>("starting");
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let last = { code: "", at: 0 };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera API");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const { BarcodeDetector } = await import("barcode-detector/ponyfill");
        const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        if (cancelled) return;
        setStatus("scanning");

        const tick = async () => {
          if (cancelled) return;
          if (!pausedRef.current && video.readyState >= 2) {
            try {
              const code = (await detector.detect(video))[0]?.rawValue;
              const now = Date.now();
              // Debounce: ignore the same code for 3s.
              if (code && (code !== last.code || now - last.at > 3000)) {
                last = { code, at: now };
                setFlash(true);
                setTimeout(() => setFlash(false), 250);
                navigator.vibrate?.(80);
                onDetectedRef.current(code);
              }
            } catch {
              // a bad frame; keep going
            }
          }
          timer = setTimeout(tick, 200);
        };
        tick();
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (status === "unavailable") {
    return (
      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Camera not available (permission denied or no camera). Enter the barcode below instead.
      </p>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} playsInline muted className="size-full object-cover" />
      {/* Square target: codes decode in either orientation. The outer shadow shades everything else. */}
      <div className={cn("pointer-events-none absolute top-1/2 left-1/2 aspect-square h-[72%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)] transition-colors",
        flash ? "border-green-400 bg-green-400/30" : "border-white/80")} />
      <p className="absolute inset-x-0 bottom-2 text-center text-sm text-white/90">
        {status === "starting" ? "Starting camera…" : "Point at a barcode"}
      </p>
    </div>
  );
}
