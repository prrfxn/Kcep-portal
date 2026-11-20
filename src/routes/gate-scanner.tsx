import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, KeyRound, RotateCcw, ScanLine, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeading } from "@/components/portal/PageHeading";
import { QrScanner } from "@/components/portal/QrScanner";
import { StudentPhoto } from "@/components/portal/StudentPhoto";
import { fmtDate, fmtTime } from "@/lib/portal-format";
import { supabase, type DbEvent, type DbPass, type DbStudent, type DbVenue } from "@/lib/supabase";

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

type ScanState =
  | { kind: "idle" }
  | { kind: "invalid"; token: string }
  | {
      kind: "used" | "approved" | "expired" | "wrong_event";
      pass: DbPass;
      student: DbStudent | null;
      event: DbEvent | null;
      venue: DbVenue | null;
    };

function isEventExpired(eventDate: string, endTime: string): boolean {
  if (!eventDate) return false;
  const normTime = (endTime || "23:59").slice(0, 5);
  const eventEnd = new Date(`${eventDate}T${normTime}:00`);
  if (isNaN(eventEnd.getTime())) return false;
  const now = new Date();
  return now >= eventEnd;
}

function GateScannerPage() {
  const [role, setRole] = useState("student");
  const [approvedEvents, setApprovedEvents] = useState<DbEvent[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const selectedEventIdRef = useRef<string>("all");
  selectedEventIdRef.current = selectedEventId;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setRole(sessionStorage.getItem("kcc-role") ?? "student");
      const interval = setInterval(() => {
        setRole(sessionStorage.getItem("kcc-role") ?? "student");
      }, 500);
      return () => clearInterval(interval);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function loadData() {
      const [eventsRes, venuesRes] = await Promise.all([
        supabase
          .from("events")
          .select("*")
          .eq("status", "approved")
          .order("event_date")
          .order("start_time"),
        supabase.from("venues").select("*"),
      ]);
      if (eventsRes.data) setApprovedEvents(eventsRes.data as DbEvent[]);
      if (venuesRes.data) setVenues(venuesRes.data as DbVenue[]);
    }
    loadData();
  }, []);

  const venueMap = new Map<string, DbVenue>(venues.map((v) => [v.id, v]));
  const activeApprovedEvents = approvedEvents.filter(
    (ev) => !isEventExpired(ev.event_date, ev.end_time)
  );

  const [result, setResult] = useState<ScanState>({ kind: "idle" });
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const last = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  async function handle(raw: string) {
    const t = raw.trim().toUpperCase();
    if (!t) return;
    const now = Date.now();
    if (last.current.token === t && now - last.current.at < 3000) return;
    last.current = { token: t, at: now };

    setScanning(true);

    // Look up pass
    const { data: passData } = await supabase
      .from("event_passes")
      .select("*")
      .eq("pass_token", t)
      .maybeSingle();

    if (!passData) {
      setResult({ kind: "invalid", token: t });
      setScanning(false);
      return;
    }

    const pass = passData as DbPass;

    // Fetch student
    const { data: studentData } = await supabase
      .from("college_student_registry")
      .select("*")
      .eq("roll_no", pass.roll_no)
      .maybeSingle();

    // Fetch event
    const { data: eventData } = await supabase
      .from("events")
      .select("*")
      .eq("id", pass.event_id)
      .maybeSingle();

    // Fetch venue
    let venue: DbVenue | null = null;
    if (eventData) {
      const venueId = (eventData as DbEvent).assigned_venue_id ?? (eventData as DbEvent).requested_venue_id;
      const { data: venueData } = await supabase
        .from("venues")
        .select("*")
        .eq("id", venueId)
        .maybeSingle();
      venue = venueData as DbVenue | null;
    }

    const student = studentData as DbStudent | null;
    const event = eventData as DbEvent | null;

    // Validation 1: Pass Expired check (evaluated first, before checking selectedEventId)
    if (event && isEventExpired(event.event_date, event.end_time)) {
      setResult({
        kind: "expired",
        pass,
        student,
        event,
        venue,
      });
      setScanning(false);
      return;
    }

    // Validation 2: Wrong Event check (only if not expired)
    const activeSelectedId = selectedEventIdRef.current;
    if (activeSelectedId !== "all" && pass.event_id !== activeSelectedId) {
      setResult({
        kind: "wrong_event",
        pass,
        student,
        event,
        venue,
      });
      setScanning(false);
      return;
    }

    // Validation 3: Pass already used check
    if (pass.is_used) {
      setResult({
        kind: "used",
        pass,
        student,
        event,
        venue,
      });
      setScanning(false);
      return;
    }

    // Mark as used
    const scannedAt = new Date().toISOString();
    await supabase
      .from("event_passes")
      .update({ is_used: true, scanned_at: scannedAt })
      .eq("id", pass.id);

    setResult({
      kind: "approved",
      pass: { ...pass, is_used: true, scanned_at: scannedAt },
      student,
      event,
      venue,
    });
    setScanning(false);
  }

  function manual(e: FormEvent) {
    e.preventDefault();
    last.current = { token: "", at: 0 };
    handle(token);
    setToken("");
  }

  if (role !== "gate" && role !== "admin") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-secondary p-4">
          <KeyRound className="size-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Gate Staff Access Required</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Switch your role to <strong>Gate Staff</strong> or <strong>Admin</strong> in the header and enter the passcode to access the scanner.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeading
        title="Gate Scanner"
        subtitle="Scan a pass QR code or enter its token. Each pass admits once."
      />
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        {/* Scanning For Event dropdown */}
        <div className="flex flex-col gap-2.5 border-b border-border bg-surface/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <Label htmlFor="scanning-for-event" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scanning For Event
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {selectedEventId === "all"
                ? "Validates passes across any active campus event"
                : `Strict mode: only passes for "${approvedEvents.find((e) => e.id === selectedEventId)?.title ?? "selected event"}" are accepted`}
            </p>
          </div>
          <div className="w-full sm:w-80 shrink-0">
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger id="scanning-for-event" className="w-full bg-background text-xs">
                <SelectValue placeholder="Any Active Event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Active Event</SelectItem>
                {activeApprovedEvents.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Approved Events
                    </SelectLabel>
                    {activeApprovedEvents.map((ev) => {
                      const v = venueMap.get(ev.assigned_venue_id ?? ev.requested_venue_id);
                      return (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.title} · {fmtDate(ev.event_date)}{v ? ` (${v.name})` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-2">
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
                <Button type="submit" variant="secondary" disabled={scanning}>
                  {scanning ? "Verifying…" : "Verify"}
                </Button>
              </div>
            </form>
          </div>
          <div className="flex min-h-[28rem] flex-col p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Status</h2>
              {result.kind !== "idle" && (
                <Button size="sm" variant="ghost" onClick={() => setResult({ kind: "idle" })}>
                  <RotateCcw /> Reset
                </Button>
              )}
            </div>
            <StatusPanel result={result} />
          </div>
        </div>
      </div>
    </>
  );
}

function StatusPanel({ result }: { result: ScanState }) {
  if (result.kind === "idle")
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
        <p className="mt-3 text-lg font-bold tracking-tight text-destructive">INVALID PASS</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{result.token}</p>
      </div>
    );

  const { student, event, venue, pass } = result;
  const approved = result.kind === "approved";

  let statusText = "ENTRY APPROVED";
  if (result.kind === "used") {
    statusText = "REJECTED: PASS ALREADY USED";
  } else if (result.kind === "expired") {
    statusText = "REJECTED: PASS EXPIRED";
  } else if (result.kind === "wrong_event") {
    statusText = "REJECTED: WRONG EVENT";
  }

  const studentShape = student
    ? { name: student.full_name, photo: student.photo_url ?? undefined }
    : undefined;

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
        {statusText}
      </p>
      {result.kind === "expired" && event && (
        <p className="mt-1 text-xs font-medium text-destructive">
          This event ended at {event.end_time?.slice(0, 5)} on {fmtDate(event.event_date)}
        </p>
      )}
      <StudentPhoto student={studentShape} className="mt-4 h-32 w-28 border border-border" />
      <p className="mt-3 text-base font-semibold">{student?.full_name ?? "Unknown student"}</p>
      <dl className="mt-3 grid w-full max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-sm">
        <dt className="text-muted-foreground">Roll No</dt>
        <dd className="font-mono">{pass.roll_no}</dd>
        <dt className="text-muted-foreground">Branch</dt>
        <dd>{student?.branch ?? "—"}</dd>
        <dt className="text-muted-foreground">Event</dt>
        <dd>{event?.title ?? "—"}</dd>
        <dt className="text-muted-foreground">Venue</dt>
        <dd>{venue?.name ?? "—"}</dd>
      </dl>
      {result.kind === "used" && pass.scanned_at && (
        <p className="mt-3 text-xs text-destructive">
          First used at{" "}
          {fmtTime(new Date(pass.scanned_at).toTimeString().slice(0, 5))}
        </p>
      )}
      {result.kind === "wrong_event" && event && (
        <p className="mt-3 text-xs text-destructive">
          Pass is for &ldquo;{event.title}&rdquo;, not the selected event.
        </p>
      )}
    </div>
  );
}
