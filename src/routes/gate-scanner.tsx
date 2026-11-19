import { useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, KeyRound, RotateCcw, ScanLine, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/portal/PageHeading";
import { QrScanner } from "@/components/portal/QrScanner";
import { StudentPhoto } from "@/components/portal/StudentPhoto";
import { scanPass, venueById, type ScanResult } from "@/lib/portal-logic";
import { getPortalState, setPortalState, usePortal } from "@/lib/portal-store";
import { fmtTime } from "@/lib/portal-format";

export const Route = createFileRoute("/gate-scanner")({
  head: () => ({
    meta: [
      { title: "Gate Scanner · KCC Event & Pass Portal" },
      {
        name: "description",
        content: "Scan KCC digital entry passes at the event gate and verify students instantly.",
      },
      { property: "og:title", content: "Gate Scanner · KCC Event & Pass Portal" },
      {
        property: "og:description",
        content: "Scan KCC digital entry passes at the event gate and verify students instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GateScannerPage,
});

function GateScannerPage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [token, setToken] = useState("");
  const last = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  function handle(raw: string) {
    const t = raw.trim().toUpperCase();
    if (!t) return;
    const now = Date.now();
    // The camera reports the same code many times per second; ignore repeats briefly.
    if (last.current.token === t && now - last.current.at < 3000) return;
    last.current = { token: t, at: now };
    const res = scanPass(getPortalState(), t, now);
    setPortalState(res.state);
    setResult(res.result);
  }

  function manual(e: FormEvent) {
    e.preventDefault();
    last.current = { token: "", at: 0 };
    handle(token);
    setToken("");
  }

  return (
    <>
      <PageHeading
        title="Gate Scanner"
        subtitle="Scan a pass QR code or enter its token. Each pass admits once."
      />
      <div className="grid overflow-hidden rounded-xl border border-border bg-surface shadow-card md:grid-cols-2">
        <div className="space-y-5 border-b border-border p-5 sm:p-6 md:border-b-0 md:border-r">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ScanLine className="size-4" /> Webcam scanner
          </h2>
          <QrScanner onScan={handle} />
          <form onSubmit={manual} className="space-y-1.5">
            <Label
              htmlFor="token"
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <KeyRound className="size-3.5" /> Manual token (for testing)
            </Label>
            <div className="flex gap-2">
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="KCC-XXXX-XXXX"
                className="font-mono uppercase"
              />
              <Button type="submit" variant="secondary">
                Verify
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Try <span className="font-mono">KCC-DEMO-PASS</span> (first time) or{" "}
              <span className="font-mono">KCC-DEMO-USED</span>.
            </p>
          </form>
        </div>
        <div className="flex min-h-[28rem] flex-col p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Status</h2>
            {result && (
              <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                <RotateCcw /> Reset
              </Button>
            )}
          </div>
          <StatusPanel result={result} />
        </div>
      </div>
    </>
  );
}

function StatusPanel({ result }: { result: ScanResult | null }) {
  const state = usePortal();
  if (!result)
    return (
      <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary">
            <ScanLine className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-3 text-sm font-medium">Idle</p>
          <p className="text-xs text-muted-foreground">Waiting for a pass to be scanned</p>
        </div>
      </div>
    );

  if (result.kind === "invalid")
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-destructive/30 bg-danger-soft p-6 text-center">
        <XCircle className="size-12 text-destructive" />
        <p className="mt-3 text-lg font-bold tracking-tight text-destructive">
          REJECTED: INVALID PASS
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{result.token}</p>
      </div>
    );

  const { student, booking, pass } = result;
  const approved = result.kind === "approved";
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center rounded-xl border p-6 text-center ${
        approved ? "border-success/30 bg-success-soft" : "border-destructive/30 bg-danger-soft"
      }`}
    >
      {approved ? (
        <CheckCircle2 className="size-10 text-success" />
      ) : (
        <XCircle className="size-10 text-destructive" />
      )}
      <p
        className={`mt-2 text-lg font-bold tracking-tight ${approved ? "text-success" : "text-destructive"}`}
      >
        {approved ? "ENTRY APPROVED" : "REJECTED: PASS ALREADY USED"}
      </p>
      <StudentPhoto student={student} className="mt-4 h-32 w-28 border border-border" />
      <p className="mt-3 text-base font-semibold">{student?.name ?? "Unknown student"}</p>
      <dl className="mt-3 grid w-full max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-sm">
        <dt className="text-muted-foreground">Roll No</dt>
        <dd className="font-mono">{pass.roll}</dd>
        <dt className="text-muted-foreground">Branch</dt>
        <dd>{student?.branch ?? "—"}</dd>
        <dt className="text-muted-foreground">Event</dt>
        <dd>{booking?.title ?? "—"}</dd>
        <dt className="text-muted-foreground">Venue</dt>
        <dd>{venueById(state, booking?.venueId)?.name ?? "—"}</dd>
      </dl>
      {!approved && pass.usedAt && pass.usedAt > 1000 && (
        <p className="mt-3 text-xs text-destructive">
          First used at {fmtTime(new Date(pass.usedAt).toTimeString().slice(0, 5))}
        </p>
      )}
    </div>
  );
}
