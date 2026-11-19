import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScannerInstance = { stop: () => Promise<void>; clear: () => void };
const READER_ID = "kcc-qr-reader";

export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanner = useRef<ScannerInstance | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  async function start() {
    setError(null);
    setStarting(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const s = new Html5Qrcode(READER_ID, { verbose: false });
      scanner.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 200, height: 200 } },
        (text) => onScanRef.current(text),
        () => {},
      );
      setActive(true);
    } catch {
      scanner.current = null;
      setError("Camera unavailable. Allow camera access, or use the manual token box below.");
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    const s = scanner.current;
    scanner.current = null;
    setActive(false);
    try {
      await s?.stop();
      s?.clear();
    } catch {
      /* already stopped */
    }
  }

  useEffect(() => () => void scanner.current?.stop().catch(() => {}), []);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-primary">
        <div id={READER_ID} className="size-full [&_video]:size-full [&_video]:object-cover" />
        {!active && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-primary-foreground">
            <div className="relative grid size-56 place-items-center rounded-2xl border-2 border-dashed border-primary-foreground/30">
              <span className="scan-line absolute left-3 right-3 top-3 h-0.5 rounded-full bg-success" />
              <div>
                <Camera className="mx-auto size-7 opacity-70" />
                <p className="mt-2 text-xs opacity-70">Camera is off</p>
              </div>
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {active ? (
        <Button variant="outline" className="w-full" onClick={stop}>
          <CameraOff /> Stop camera
        </Button>
      ) : (
        <Button className="w-full" onClick={start} disabled={starting}>
          <Camera /> {starting ? "Starting camera…" : "Start webcam scanner"}
        </Button>
      )}
    </div>
  );
}
