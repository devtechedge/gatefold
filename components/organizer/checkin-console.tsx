"use client";

import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState } from "react";

interface CheckInPayload {
  result: "CHECKED_IN" | "ALREADY_USED";
  ticket: {
    publicId: string;
    attendeeName: string;
    ticketType: string;
    eventTitle: string;
    startsAt: string;
  };
  checkIn: { scannedAt: string; gateLabel: string };
  message: string;
}

export function CheckInConsole({
  eventId,
  eventTitle,
  disabled,
}: {
  eventId: string;
  eventTitle: string;
  disabled: boolean;
}) {
  const [payload, setPayload] = useState("");
  const [gateLabel, setGateLabel] = useState("Main door");
  const [result, setResult] = useState<CheckInPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const busyRef = useRef(false);
  const lastScan = useRef({ value: "", at: 0 });

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const verify = useCallback(
    async (value: string, method: "SCAN" | "MANUAL") => {
      const trimmed = value.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const response = await fetch("/api/tickets/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            payload: trimmed,
            eventId,
            gateLabel,
            method,
          }),
        });
        const body = (await response.json()) as
          | { data: CheckInPayload }
          | { error: { message: string } };
        if (!response.ok || "error" in body) {
          setError("error" in body ? body.error.message : "The scan could not be verified.");
          return;
        }
        setResult(body.data);
        setPayload("");
        if (method === "SCAN") stopCamera();
      } catch {
        setError("The network dropped before verification. Check the connection and scan again.");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [eventId, gateLabel, stopCamera]
  );

  function scanLoop() {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          const now = Date.now();
          if (code.data !== lastScan.current.value || now - lastScan.current.at > 4000) {
            lastScan.current = { value: code.data, at: now };
            void verify(code.data, "SCAN");
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not expose a camera. Use the manual code field below.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      scanningRef.current = true;
      setCameraOn(true);
      rafRef.current = requestAnimationFrame(scanLoop);
    } catch {
      setCameraError("Camera permission was refused or the camera is unavailable. Use the manual code field.");
    }
  }

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  function reset() {
    setResult(null);
    setError(null);
    setPayload("");
  }

  return (
    <div className="scan-console p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/15 pb-4">
        <div>
          <p className="eyebrow" style={{ color: "#c8f04a" }}>Door console</p>
          <h2 className="mt-1 text-xl" style={{ fontFamily: "var(--type-display)" }}>{eventTitle}</h2>
        </div>
        <label className="text-xs" style={{ color: "#cabfb2" }}>
          Gate label
          <input
            className="input mt-1 w-40"
            style={{ background: "#141118", color: "#f6efe3", borderColor: "#5a5064" }}
            value={gateLabel}
            maxLength={80}
            onChange={(event) => setGateLabel(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="scan-frame">
            {cameraOn ? (
              <video ref={videoRef} muted playsInline aria-label="Camera preview for ticket scanning" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <p className="text-sm" style={{ color: "#cabfb2" }}>Camera is off.</p>
                <button
                  type="button"
                  className="btn mt-3"
                  style={{ borderColor: "#c8f04a", color: "#c8f04a" }}
                  onClick={startCamera}
                  disabled={disabled}
                >
                  Start camera
                </button>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: "#a99e92" }}>
            <span>Camera scans locally. Only the decoded code is sent to the server.</span>
            {cameraOn ? (
              <button type="button" className="underline" onClick={stopCamera}>Stop camera</button>
            ) : null}
          </div>
          {cameraError ? (
            <p role="alert" className="mt-2 text-xs" style={{ color: "#ffc46b" }}>{cameraError}</p>
          ) : null}
          {disabled ? (
            <p className="mt-2 text-xs" style={{ color: "#ffc46b" }}>
              This event is cancelled. Check-in is disabled.
            </p>
          ) : null}
        </div>

        <div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verify(payload, "MANUAL");
            }}
          >
            <label className="label" style={{ color: "#cabfb2" }} htmlFor="manual-code">
              Manual ticket code or QR payload
            </label>
            <input
              id="manual-code"
              className="input mono"
              style={{ background: "#141118", color: "#f6efe3", borderColor: "#5a5064" }}
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              placeholder="GF-XXXX-XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
            />
            <button
              type="submit"
              className="btn btn-accent mt-3 w-full"
              disabled={disabled || busy || !payload.trim()}
            >
              {busy ? "Verifying..." : "Verify ticket"}
            </button>
          </form>

          <div className="mt-4" role="status" aria-live="polite">
            {error ? (
              <div className="scan-result-bad p-4">
                <p className="text-sm font-medium">Not admitted</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            ) : null}
            {result ? (
              <div className={`${result.result === "CHECKED_IN" ? "scan-result-ok" : "scan-result-warn"} p-4`}>
                <p className="text-sm font-medium">
                  {result.result === "CHECKED_IN" ? "Checked in" : "Already used"}
                </p>
                <p className="mt-1 text-sm">{result.message}</p>
                <dl className="mt-3 space-y-1 text-xs">
                  <div><dt className="inline opacity-70">Attendee: </dt><dd className="inline">{result.ticket.attendeeName}</dd></div>
                  <div><dt className="inline opacity-70">Ticket: </dt><dd className="inline">{result.ticket.ticketType}</dd></div>
                  <div><dt className="inline opacity-70">Code: </dt><dd className="inline mono">{result.ticket.publicId}</dd></div>
                  <div><dt className="inline opacity-70">Gate: </dt><dd className="inline">{result.checkIn.gateLabel || "not set"}</dd></div>
                </dl>
                <button type="button" className="btn btn-sm mt-3" onClick={reset}>
                  Scan next
                </button>
              </div>
            ) : null}
            {!error && !result ? (
              <p className="text-xs" style={{ color: "#a99e92" }}>
                Scan a QR code or type the ticket code. Results appear here and are announced to
                assistive technology.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
