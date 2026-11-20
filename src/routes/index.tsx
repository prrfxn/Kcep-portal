import { useState, useEffect, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock, Inbox, MapPin, Search, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeading } from "@/components/portal/PageHeading";
import { ClaimPassDialog } from "@/components/portal/ClaimPassDialog";
import { PassCard } from "@/components/portal/PassCard";
import { fmtDate, fmtDay, fmtMonth, fmtRange, fmtTime } from "@/lib/portal-format";
import { supabase, type DbEvent, type DbPass, type DbVenue } from "@/lib/supabase";
import type { DbStudent } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Events & Passes · KCC Event & Pass Portal" },
      {
        name: "description",
        content: "Browse approved KCC campus events and claim your QR entry pass.",
      },
      { property: "og:title", content: "Events & Passes · KCC Event & Pass Portal" },
      {
        property: "og:description",
        content: "Browse approved KCC campus events and claim your QR entry pass.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventsPage,
});

type EventWithSeats = DbEvent & {
  venue?: DbVenue;
  totalSeats: number;
  remainingSeats: number;
};

type MyPass = DbPass & { event?: DbEvent; venue?: DbVenue; student?: DbStudent };

// ── "View My Passes" dialog ───────────────────────────────────────────────────
function MyPassesDialog({
  open,
  onOpenChange,
  venueMap,
  existingEvents = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueMap: Map<string, DbVenue>;
  existingEvents?: DbEvent[];
}) {
  const [roll, setRoll] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passes, setPasses] = useState<MyPass[] | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setError(null);
      setShowQr(null);
    }
    onOpenChange(nextOpen);
  }

  async function findPasses(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const normalizedRoll = roll.trim().toUpperCase();
    const normalizedEmail = email.trim();

    // 1. Verify roll_no and official_email against college_student_registry
    const { data: studentData, error: studentError } = await supabase
      .from("college_student_registry")
      .select("*")
      .eq("roll_no", normalizedRoll)
      .ilike("official_email", normalizedEmail)
      .maybeSingle();

    if (studentError) {
      setError(studentError.message);
      setLoading(false);
      return;
    }

    if (!studentData) {
      setError("No student found with this roll number and college email.");
      setLoading(false);
      return;
    }
    const st = studentData as DbStudent;

    // 2. Fetch event_passes with .select("*") for roll_no (no ambiguous joins)
    const { data: passData, error: passError } = await supabase
      .from("event_passes")
      .select("*")
      .eq("roll_no", normalizedRoll)
      .order("claimed_at", { ascending: false });

    if (passError) {
      setError(passError.message);
      setLoading(false);
      return;
    }

    if (!passData || passData.length === 0) {
      setPasses([]);
      setLoading(false);
      return;
    }

    // 3. Match against the already-loaded events list in state, fetching any missing
    const eventMap = new Map<string, DbEvent>(existingEvents.map((ev) => [ev.id, ev]));
    const missingIds = (passData as DbPass[])
      .map((p) => p.event_id)
      .filter((id) => !eventMap.has(id));

    if (missingIds.length > 0) {
      const { data: missingEvents } = await supabase
        .from("events")
        .select("*")
        .in("id", [...new Set(missingIds)]);
      if (missingEvents) {
        for (const ev of (missingEvents as DbEvent[])) {
          eventMap.set(ev.id, ev);
        }
      }
    }

    const enriched: MyPass[] = (passData as DbPass[]).map((p) => {
      const ev = eventMap.get(p.event_id);
      const venueId = ev ? (ev.assigned_venue_id ?? ev.requested_venue_id) : undefined;
      return { ...p, event: ev, venue: venueId ? venueMap.get(venueId) : undefined, student: st };
    });

    setPasses(enriched);
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="size-5 text-primary" /> View My Passes
          </DialogTitle>
          <DialogDescription>
            Enter your roll number and college email to view your claimed entry passes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={findPasses} className="mt-2 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="my-roll" className="text-xs">
                Roll Number
              </Label>
              <Input
                id="my-roll"
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                placeholder="e.g. 2404920310001"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="my-email" className="text-xs">
                College Email
              </Label>
              <Input
                id="my-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@kcc.edu.in"
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            <Search className="size-4" /> {loading ? "Searching passes…" : "Find Passes"}
          </Button>
        </form>

        {error && (
          <p className="mt-2 rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
            {error}
          </p>
        )}

        {passes !== null && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {passes.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No passes found for this student.
              </p>
            ) : (
              passes.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight">{p.event?.title ?? "Event Pass"}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {p.event && (
                          <>
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="size-3" />
                              {fmtDate(p.event.event_date)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {p.venue?.name ?? "Campus"}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.pass_token}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant={p.is_used ? "neutral" : "success"}>
                        {p.is_used ? "USED" : "ACTIVE"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowQr(showQr === p.id ? null : p.id)}
                      >
                        {showQr === p.id ? "Hide QR" : "Show QR"}
                      </Button>
                    </div>
                  </div>
                  {showQr === p.id && p.event && (
                    <div className="mt-4 flex justify-center border-t border-border pt-4">
                      <PassCard
                        pass={{
                          token: p.pass_token,
                          roll: p.roll_no,
                          bookingId: p.event_id,
                          status: p.is_used ? "used" : "active",
                          claimedAt: new Date(p.claimed_at).getTime(),
                          usedAt: p.scanned_at ? new Date(p.scanned_at).getTime() : undefined,
                        }}
                        student={{
                          roll: p.student?.roll_no ?? p.roll_no,
                          name: p.student?.full_name ?? "Unknown",
                          branch: p.student?.branch ?? "",
                          email: p.student?.official_email ?? "",
                          photo: p.student?.photo_url ?? undefined,
                        }}
                        booking={{
                          id: p.event.id,
                          title: p.event.title,
                          description: p.event.description,
                          organizerRoll: p.event.organizer_roll_no,
                          venueId: p.event.assigned_venue_id ?? p.event.requested_venue_id,
                          date: p.event.event_date,
                          startTime: p.event.start_time,
                          endTime: p.event.end_time,
                          expectedCrowd: p.event.expected_crowd,
                          status: p.event.status as "approved",
                          createdAt: new Date(p.event.created_at).getTime(),
                        }}
                        venue={
                          p.venue
                            ? {
                                id: p.venue.id,
                                name: p.venue.name,
                                capacity: p.venue.capacity,
                                kind: p.venue.kind,
                              }
                            : undefined
                        }
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function isEventActive(eventDate: string, endTime: string): boolean {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (eventDate > todayStr) return true;
  if (eventDate < todayStr) return false;

  // Same day: check end_time
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${hours}:${minutes}`;
  const normEnd = (endTime || "23:59").slice(0, 5);
  return normEnd > currentTimeStr;
}

function isEventLive(eventDate: string, startTime: string, endTime: string): boolean {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (eventDate !== todayStr) return false;

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${hours}:${minutes}`;
  const normStart = (startTime || "00:00").slice(0, 5);
  const normEnd = (endTime || "23:59").slice(0, 5);
  return normStart <= currentTimeStr && normEnd > currentTimeStr;
}

// ── Main page ─────────────────────────────────────────────────────────────────
function EventsPage() {
  const [events, setEvents] = useState<EventWithSeats[]>([]);
  const [claiming, setClaiming] = useState<EventWithSeats | null>(null);
  const [loading, setLoading] = useState(true);
  const [venueMap, setVenueMap] = useState<Map<string, DbVenue>>(new Map());
  const [myPassesOpen, setMyPassesOpen] = useState(false);

  async function loadEvents() {
    setLoading(true);
    const { data: evData } = await supabase
      .from("events")
      .select("*")
      .eq("status", "approved")
      .order("event_date")
      .order("start_time");

    if (!evData) { setLoading(false); return; }

    const { data: venueData } = await supabase.from("venues").select("*");
    const vm = new Map<string, DbVenue>(
      (venueData ?? []).map((v: DbVenue) => [v.id, v]),
    );
    setVenueMap(vm);

    const enriched: EventWithSeats[] = await Promise.all(
      (evData as DbEvent[]).map(async (ev) => {
        const venueId = ev.assigned_venue_id ?? ev.requested_venue_id;
        const venue = vm.get(venueId);
        const capacity = venue?.capacity ?? ev.expected_crowd;
        const totalSeats = Math.min(ev.expected_crowd, capacity);
        const { count } = await supabase
          .from("event_passes")
          .select("*", { count: "exact", head: true })
          .eq("event_id", ev.id);
        const usedCount = count ?? 0;
        const remainingSeats = Math.max(0, totalSeats - usedCount);
        return { ...ev, venue, totalSeats, remainingSeats };
      }),
    );

    setEvents(enriched);
    setLoading(false);
  }

  useEffect(() => { loadEvents(); }, []);

  const activeEvents = events.filter((ev) => isEventActive(ev.event_date, ev.end_time));

  return (
    <>
      <PageHeading
        title="Events & Passes"
        subtitle="Approved campus events. Claim a pass to get your QR entry ticket."
        action={
          <Button
            variant="outline"
            onClick={() => setMyPassesOpen(true)}
            className="gap-2"
          >
            <Inbox className="size-4" />
            View My Passes
          </Button>
        }
      />

      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-sm text-muted-foreground">
          Loading events…
        </div>
      ) : activeEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-sm text-muted-foreground">
          No upcoming events scheduled right now.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Upcoming events ({activeEvents.length})
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeEvents.map((ev) => {
              const { totalSeats, remainingSeats } = ev;
              const pct = totalSeats ? Math.round(((totalSeats - remainingSeats) / totalSeats) * 100) : 100;
              const isLive = isEventLive(ev.event_date, ev.start_time, ev.end_time);
              return (
                <article
                  key={ev.id}
                  className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div className="grid w-12 shrink-0 place-items-center rounded-lg border border-border py-1.5 text-center leading-none">
                      <span className="text-[10px] font-medium uppercase text-muted-foreground">
                        {fmtMonth(ev.event_date)}
                      </span>
                      <span className="mt-0.5 text-lg font-semibold">{fmtDay(ev.event_date)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold leading-snug">{ev.title}</h2>
                        {isLive && (
                          <Badge
                            variant="success"
                            className="gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          >
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            LIVE NOW
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ev.description}</p>
                    </div>
                  </div>

                  <dl className="mt-4 space-y-1.5 text-sm">
                    <Row icon={MapPin} label={ev.venue?.name ?? "—"} />
                    <Row icon={CalendarDays} label={fmtDate(ev.event_date)} />
                    <Row icon={Clock} label={fmtRange(ev.start_time, ev.end_time)} />
                  </dl>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Users className="size-3.5" /> Remaining seats
                      </span>
                      {remainingSeats > 0 ? (
                        <Badge variant={remainingSeats <= totalSeats * 0.1 ? "warning" : "success"}>
                          {remainingSeats} / {totalSeats}
                        </Badge>
                      ) : (
                        <Badge variant="danger">Full</Badge>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <Button
                    className="mt-5 w-full"
                    disabled={remainingSeats === 0}
                    onClick={() => setClaiming(ev)}
                  >
                    <Ticket /> Claim Entry Pass
                  </Button>
                </article>
              );
            })}
          </div>
        </>
      )}
      <ClaimPassDialog
        event={claiming}
        onClose={() => { setClaiming(null); loadEvents(); }}
      />
      <MyPassesDialog
        open={myPassesOpen}
        onOpenChange={setMyPassesOpen}
        venueMap={venueMap}
        existingEvents={events}
      />
    </>
  );
}

function Row({ icon: Icon, label }: { icon: typeof MapPin; label: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="size-4 shrink-0" />
      <span className="truncate text-foreground">{label}</span>
    </div>
  );
}
