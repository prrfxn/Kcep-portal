import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { QRCodeSVG } from "qrcode.react";
import { Copy, MapPin, CalendarDays, Download } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { StudentPhoto } from "./StudentPhoto";
import type { Booking, Pass, Student, Venue } from "@/lib/portal-logic";
import { fmtDate, fmtTime } from "@/lib/portal-format";

export function PassCard({
  pass,
  student,
  booking,
  venue,
}: {
  pass: Pass;
  student?: Student | undefined;
  booking?: Booking | undefined;
  venue?: Venue | undefined;
}) {
  const active = pass.status === "active";
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadPass() {
    if (!cardRef.current) return;
    try {
      setDownloading(true);
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        skipFonts: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `KCC-Pass-${pass.roll}-${pass.token.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Pass downloaded (PNG)");
    } catch (err) {
      console.error(err);
      toast.error("Failed to download pass image");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[320px]">
      {/* ── Styled ticket card container (captured by html-to-image) ────── */}
      <div
        ref={cardRef}
        className="overflow-hidden rounded-2xl border border-border bg-surface shadow-pass"
      >
        <div className="flex items-center justify-between bg-primary px-5 py-3 text-primary-foreground">
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">KCC</p>
            <p className="text-sm font-semibold">Digital Entry Pass</p>
          </div>
          <Badge variant={active ? "success" : "neutral"} className="tracking-wider">
            {active ? "ACTIVE" : "USED"}
          </Badge>
        </div>

        <div className="flex flex-col items-center px-5 pt-5">
          <StudentPhoto student={student} className="h-28 w-24 border border-border" />
          <p className="mt-3 text-base font-semibold">{student?.name ?? "Unknown"}</p>
          <p className="font-mono text-xs text-muted-foreground">{pass.roll}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{student?.branch}</p>
        </div>

        <div className="mx-5 mt-4 rounded-lg bg-secondary px-3 py-2.5 text-center">
          <p className="text-sm font-semibold">{booking?.title}</p>
          {booking && (
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {venue?.name}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3" />
                {fmtDate(booking.date)} · {fmtTime(booking.startTime)}
              </span>
            </div>
          )}
        </div>

        <div className="relative my-4 border-t border-dashed border-border">
          <span className="absolute -left-3 -top-3 size-6 rounded-full border border-border bg-background" />
          <span className="absolute -right-3 -top-3 size-6 rounded-full border border-border bg-background" />
        </div>

        <div className="flex flex-col items-center px-5 pb-5">
          <div className="rounded-lg border border-border bg-surface p-2.5">
            <QRCodeSVG value={pass.token} size={148} level="M" />
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(pass.token);
              toast.success("Pass token copied");
            }}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {pass.token}
            <Copy className="size-3" />
          </button>
        </div>
      </div>

      {/* ── Action button row (excluded from image capture) ──────────────── */}
      <div className="mt-3 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={downloadPass}
          disabled={downloading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary disabled:opacity-50"
        >
          <Download className="size-3.5" />
          {downloading ? "Generating PNG…" : "Download Pass (PNG)"}
        </button>
      </div>
    </div>
  );
}
