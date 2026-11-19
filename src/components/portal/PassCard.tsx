import { QRCodeSVG } from "qrcode.react";
import { Copy, MapPin, CalendarDays } from "lucide-react";
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
  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-border bg-surface shadow-pass">
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
  );
}
