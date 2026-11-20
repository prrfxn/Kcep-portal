import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  Ban,
  CalendarCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  MapPin,
  Repeat,
  Ticket,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeading } from "@/components/portal/PageHeading";
import { StudentPhoto } from "@/components/portal/StudentPhoto";
import { fmtDate, fmtRange } from "@/lib/portal-format";
import { supabase, timesOverlap, type DbEvent, type DbStudent, type DbVenue } from "@/lib/supabase";
import { BRANCHES } from "@/lib/portal-seed";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin · KCC Event & Pass Portal" },
      {
        name: "description",
        content: "Review KCC venue requests and manage the College ERP student registry.",
      },
      { property: "og:title", content: "Admin · KCC Event & Pass Portal" },
      {
        property: "og:description",
        content: "Review KCC venue requests and manage the College ERP student registry.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

// ── Passcode lock screen ──────────────────────────────────────────────────────
function AdminLockScreen() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Lock className="size-12 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Admin Access Required</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        Switch your role to <strong>Admin</strong> in the header to continue.
      </p>
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────
type Stats = { approvedEvents: number; totalPasses: number; checkedIn: number };

function isEventActive(eventDate: string, endTime: string): boolean {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  if (eventDate > todayStr) return true;
  if (eventDate < todayStr) return false;

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${hours}:${minutes}`;
  const normEnd = (endTime || "23:59").slice(0, 5);
  return normEnd > currentTimeStr;
}

function StatsCards({
  stats,
  isFiltered,
  selectedEventTitle,
}: {
  stats: Stats;
  isFiltered: boolean;
  selectedEventTitle?: string;
}) {
  const pct =
    stats.totalPasses > 0 ? Math.round((stats.checkedIn / stats.totalPasses) * 100) : 0;
  return (
    <div className="grid gap-4 sm:grid-cols-3 mb-6">
      <div className="rounded-xl border border-border bg-primary/10 p-5 flex items-center gap-4">
        <CalendarCheck className="size-7 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-2xl font-bold">{stats.approvedEvents}</p>
          <p className="text-xs text-muted-foreground truncate" title={selectedEventTitle}>
            {isFiltered ? (selectedEventTitle ? `Event: ${selectedEventTitle}` : "Selected Event") : "Upcoming Approved"}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-success-soft p-5 flex items-center gap-4">
        <Ticket className="size-7 text-success shrink-0" />
        <div>
          <p className="text-2xl font-bold">{stats.totalPasses}</p>
          <p className="text-xs text-muted-foreground">Passes Issued</p>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-warning-soft p-5 flex items-center gap-4">
        <CheckCircle2 className="size-7 text-warning shrink-0" />
        <div>
          <p className="text-2xl font-bold">
            {stats.checkedIn}{" "}
            <span className="text-sm font-normal text-muted-foreground">/ {stats.totalPasses}</span>
          </p>
          <p className="text-xs text-muted-foreground">Checked In at Gate ({pct}%)</p>
        </div>
      </div>
    </div>
  );
}

function EventBreakdownTable({
  events,
  venueMap,
  attendanceMap,
  selectedEventId,
  onSelectEvent,
  onEventUpdated,
}: {
  events: DbEvent[];
  venueMap: Map<string, DbVenue>;
  attendanceMap: Map<string, { total: number; used: number }>;
  selectedEventId: string;
  onSelectEvent: (id: string) => void;
  onEventUpdated: () => void;
}) {
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  if (events.length === 0) return null;

  const upcomingEvents = events.filter((ev) => isEventActive(ev.event_date, ev.end_time));
  const pastEvents = events.filter((ev) => !isEventActive(ev.event_date, ev.end_time));
  const displayedEvents = tab === "upcoming" ? upcomingEvents : pastEvents;

  async function cancelEvent(eventId: string, title: string) {
    if (
      !window.confirm(
        `Cancel approved event "${title}"?\n\nThis frees the venue slot and hides the event from active student feeds while preserving its attendance history.`,
      )
    ) {
      return;
    }
    try {
      const { error } = await supabase
        .from("events")
        .update({ status: "cancelled" })
        .eq("id", eventId);

      if (error) throw error;
      toast.success(`Event "${title}" has been cancelled`);
      onEventUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteEvent(eventId: string, title: string) {
    if (
      !window.confirm(
        `Permanently delete event "${title}" and all its passes?\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }
    try {
      // Delete child event_passes first in case FK constraint does not have CASCADE
      await supabase.from("event_passes").delete().eq("event_id", eventId);
      const { error } = await supabase.from("events").delete().eq("id", eventId);

      if (error) throw error;
      toast.success(`Event "${title}" and passes deleted`);
      onEventUpdated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border px-5 py-3.5 bg-secondary/30 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Approved Events &amp; Attendance Breakdown
          </h3>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab("upcoming")}
            className={`rounded-md px-3 py-1 transition-all ${
              tab === "upcoming"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Upcoming ({upcomingEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("past")}
            className={`rounded-md px-3 py-1 transition-all ${
              tab === "past"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Past Events ({pastEvents.length})
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Event &amp; Venue</TableHead>
              <TableHead>Date &amp; Time</TableHead>
              <TableHead className="text-center">Passes Issued</TableHead>
              <TableHead className="text-center">Checked-In</TableHead>
              <TableHead className="text-center">Attendance Rate</TableHead>
              <TableHead className="pr-5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedEvents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {tab === "upcoming" ? "No upcoming approved events." : "No past events recorded."}
                </TableCell>
              </TableRow>
            ) : (
              displayedEvents.map((ev) => {
                const att = attendanceMap.get(ev.id) ?? { total: 0, used: 0 };
                const v = venueMap.get(ev.assigned_venue_id ?? ev.requested_venue_id);
                const pct = att.total > 0 ? Math.round((att.used / att.total) * 100) : 0;
                const isSelected = selectedEventId === ev.id;
                return (
                  <TableRow
                    key={ev.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-primary/5 font-medium" : "hover:bg-secondary/40"
                    }`}
                    onClick={() => onSelectEvent(isSelected ? "all" : ev.id)}
                  >
                    <TableCell className="pl-5">
                      <p className="font-medium text-sm leading-tight">{ev.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3" /> {v?.name ?? "Campus"}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      <div>{fmtDate(ev.event_date)}</div>
                      <div>{fmtRange(ev.start_time, ev.end_time)}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="neutral" className="font-mono text-xs">
                        {att.total}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={att.used > 0 ? "success" : "neutral"}
                        className="font-mono text-xs"
                      >
                        {att.used}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-14 h-1.5 rounded-full bg-secondary overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold">{pct}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="pr-5 text-right whitespace-nowrap">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tab === "upcoming" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelEvent(ev.id, ev.title)}
                            className="h-7 px-2 text-xs text-amber-600 hover:bg-amber-500/10 hover:text-amber-600 dark:text-amber-400"
                            title="Cancel event and free venue slot"
                          >
                            <Ban className="size-3" />
                            <span className="hidden sm:inline">Cancel</span>
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteEvent(ev.id, ev.title)}
                          title={`Delete "${ev.title}"`}
                          className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function AdminPage() {
  const [role, setRole] = useState("student");
  const [pending, setPending] = useState<DbEvent[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<DbEvent[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [allStats, setAllStats] = useState<Stats>({ approvedEvents: 0, totalPasses: 0, checkedIn: 0 });
  const [attendanceMap, setAttendanceMap] = useState<Map<string, { total: number; used: number }>>(new Map());
  const [selectedMetricEventId, setSelectedMetricEventId] = useState<string>("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep role in sync if the header changes sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const initial = sessionStorage.getItem("kcc-role") ?? "student";
      setRole(initial);
      const interval = setInterval(() => {
        const r = sessionStorage.getItem("kcc-role") ?? "student";
        setRole(r);
      }, 500);
      return () => clearInterval(interval);
    } catch {
      // ignore
    }
  }, []);

  async function loadData() {
    setLoadError(null);
    try {
      const [venueRes, eventRes, approvedRes, passesRes] = await Promise.all([
        supabase.from("venues").select("*").order("name"),
        supabase.from("events").select("*").eq("status", "pending").order("created_at"),
        supabase.from("events").select("*").eq("status", "approved").order("event_date").order("start_time"),
        supabase.from("event_passes").select("id, event_id, is_used"),
      ]);
      if (venueRes.error) throw venueRes.error;
      if (eventRes.error) throw eventRes.error;
      if (approvedRes.error) throw approvedRes.error;
      if (passesRes.error) throw passesRes.error;

      setVenues((venueRes.data as DbVenue[]) ?? []);
      setPending((eventRes.data as DbEvent[]) ?? []);
      const appEvents = (approvedRes.data as DbEvent[]) ?? [];
      setApprovedEvents(appEvents);

      const attMap = new Map<string, { total: number; used: number }>();
      let totalPasses = 0;
      let totalCheckedIn = 0;
      for (const p of ((passesRes.data as { id: string; event_id: string; is_used: boolean }[]) ?? [])) {
        const cur = attMap.get(p.event_id) ?? { total: 0, used: 0 };
        cur.total += 1;
        totalPasses += 1;
        if (p.is_used) {
          cur.used += 1;
          totalCheckedIn += 1;
        }
        attMap.set(p.event_id, cur);
      }
      setAttendanceMap(attMap);
      setAllStats({
        approvedEvents: appEvents.length,
        totalPasses,
        checkedIn: totalCheckedIn,
      });
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (role === "admin") loadData();
  }, [role]);

  const venueMap = new Map<string, DbVenue>(venues.map((v) => [v.id, v]));

  if (role !== "admin") return <AdminLockScreen />;

  const upcomingApproved = approvedEvents.filter((ev) => isEventActive(ev.event_date, ev.end_time));
  const pastApproved = approvedEvents.filter((ev) => !isEventActive(ev.event_date, ev.end_time));

  let upcomingTotalPasses = 0;
  let upcomingCheckedIn = 0;
  for (const ev of upcomingApproved) {
    const att = attendanceMap.get(ev.id) ?? { total: 0, used: 0 };
    upcomingTotalPasses += att.total;
    upcomingCheckedIn += att.used;
  }
  const upcomingStats: Stats = {
    approvedEvents: upcomingApproved.length,
    totalPasses: upcomingTotalPasses,
    checkedIn: upcomingCheckedIn,
  };

  const isFiltered = selectedMetricEventId !== "all";
  const selectedEvent = isFiltered ? approvedEvents.find((e) => e.id === selectedMetricEventId) : undefined;
  const selectedAtt = isFiltered && selectedMetricEventId
    ? attendanceMap.get(selectedMetricEventId) ?? { total: 0, used: 0 }
    : undefined;

  const displayedStats: Stats = isFiltered && selectedAtt
    ? {
        approvedEvents: 1,
        totalPasses: selectedAtt.total,
        checkedIn: selectedAtt.used,
      }
    : upcomingStats;

  return (
    <>
      <PageHeading title="Admin" subtitle="Review venue requests and maintain the student registry." />

      {loadError && (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-danger-soft px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {loadError}
        </p>
      )}

      {/* Event Attendance Filter Header */}
      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Attendance Overview</h3>
          <p className="text-xs text-muted-foreground">
            {isFiltered
              ? `Showing metrics for: ${selectedEvent?.title ?? "selected event"}`
              : "Aggregated metrics for all upcoming campus events"}
          </p>
        </div>
        <div className="w-full sm:w-80">
          <Select value={selectedMetricEventId} onValueChange={setSelectedMetricEventId}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="All Upcoming Events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Upcoming Events ({upcomingApproved.length})</SelectItem>
              {upcomingApproved.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Upcoming Events
                  </SelectLabel>
                  {upcomingApproved.map((ev) => {
                    const vName = venueMap.get(ev.assigned_venue_id ?? ev.requested_venue_id)?.name;
                    return (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.title} · {fmtDate(ev.event_date)} {vName ? `(${vName})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              )}
              {pastApproved.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Past Events
                  </SelectLabel>
                  {pastApproved.map((ev) => {
                    const vName = venueMap.get(ev.assigned_venue_id ?? ev.requested_venue_id)?.name;
                    return (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.title} · {fmtDate(ev.event_date)} {vName ? `(${vName})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <StatsCards
        stats={displayedStats}
        isFiltered={isFiltered}
        selectedEventTitle={selectedEvent?.title}
      />

      <EventBreakdownTable
        events={approvedEvents}
        venueMap={venueMap}
        attendanceMap={attendanceMap}
        selectedEventId={selectedMetricEventId}
        onSelectEvent={setSelectedMetricEventId}
        onEventUpdated={loadData}
      />

      {/* Pending venue requests */}
      <section className="rounded-xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Pending Venue Requests</h2>
          <Badge variant={pending.length ? "warning" : "neutral"}>{pending.length} pending</Badge>
        </div>
        {pending.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            All caught up — no pending requests.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((ev) => (
              <PendingRow key={ev.id} event={ev} venues={venues} venueMap={venueMap} onDone={loadData} />
            ))}
          </ul>
        )}
      </section>

      <ExportAttendanceSection venues={venues} />
      <Registry onStudentAdded={loadData} />
    </>
  );
}

// ── PendingRow ────────────────────────────────────────────────────────────────
function PendingRow({
  event: ev,
  venues,
  venueMap,
  onDone,
}: {
  event: DbEvent;
  venues: DbVenue[];
  venueMap: Map<string, DbVenue>;
  onDone: () => void;
}) {
  const [reassigning, setReassigning] = useState(false);
  const [newVenueId, setNewVenueId] = useState("");
  const [remark, setRemark] = useState("");

  const reqVenue = venueMap.get(ev.requested_venue_id);

  async function checkConflict(venueId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_time, end_time, assigned_venue_id, requested_venue_id")
        .eq("status", "approved")
        .eq("event_date", ev.event_date)
        .neq("id", ev.id);
      if (error) return error.message;
      const clash = (data ?? []).find((c) => {
        const effectiveVenue = c.assigned_venue_id ?? c.requested_venue_id;
        return (
          effectiveVenue === venueId &&
          timesOverlap(ev.start_time, ev.end_time, c.start_time, c.end_time)
        );
      });
      if (clash) {
        return `${venueMap.get(venueId)?.name ?? venueId} is already booked for "${clash.title}" in that slot.`;
      }
      return null;
    } catch (err: unknown) {
      return err instanceof Error ? err.message : String(err);
    }
  }

  async function approve() {
    const conflict = await checkConflict(ev.requested_venue_id);
    if (conflict) { toast.error(conflict + " Reassign it instead."); return; }
    try {
      const { error } = await supabase
        .from("events")
        .update({ status: "approved", assigned_venue_id: ev.requested_venue_id })
        .eq("id", ev.id);
      if (error) throw error;
      toast.success(`Approved "${ev.title}"`);
      onDone();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)); }
  }

  async function reject() {
    try {
      const { error } = await supabase.from("events").update({ status: "rejected" }).eq("id", ev.id);
      if (error) throw error;
      toast(`Rejected "${ev.title}"`);
      onDone();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)); }
  }

  async function reassign(e: FormEvent) {
    e.preventDefault();
    if (!newVenueId) { toast.error("Choose a venue to reassign to."); return; }
    if (newVenueId === ev.requested_venue_id) { toast.error("Pick a different venue, or approve as requested."); return; }
    if (!remark.trim()) { toast.error("Add a remark for the organizer."); return; }
    const conflict = await checkConflict(newVenueId);
    if (conflict) { toast.error(conflict); return; }
    try {
      const { error } = await supabase
        .from("events")
        .update({ status: "reassigned", assigned_venue_id: newVenueId, admin_remark: remark.trim() })
        .eq("id", ev.id);
      if (error) throw error;
      toast.success(`Sent reassignment to ${ev.organizer_roll_no}`);
      onDone();
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : String(err)); }
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{ev.title}</p>
          {ev.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{ev.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">{ev.organizer_roll_no}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{reqVenue?.name ?? ev.requested_venue_id}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" />{fmtDate(ev.event_date)}</span>
            <span className="inline-flex items-center gap-1"><Clock className="size-3" />{fmtRange(ev.start_time, ev.end_time)}</span>
            <span className="inline-flex items-center gap-1"><Users className="size-3" />{ev.expected_crowd}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="success" onClick={approve}><Check /> Approve</Button>
          <Button size="sm" variant={reassigning ? "secondary" : "outline"} onClick={() => setReassigning((r) => !r)}><Repeat /> Reassign</Button>
          <Button size="sm" variant="danger-outline" onClick={reject}><X /> Reject</Button>
        </div>
      </div>
      {reassigning && (
        <form onSubmit={reassign} className="mt-3 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 sm:flex-row">
          <Select value={newVenueId} onValueChange={setNewVenueId}>
            <SelectTrigger className="bg-surface sm:w-60"><SelectValue placeholder="New venue" /></SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id} disabled={v.id === ev.requested_venue_id}>
                  {v.name} · {v.capacity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="Remark for the organizer" className="flex-1 bg-surface" />
          <Button type="submit" size="default">Send</Button>
        </form>
      )}
    </li>
  );
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function ExportAttendanceSection({ venues }: { venues: DbVenue[] }) {
  const [approvedEvents, setApprovedEvents] = useState<DbEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [exporting, setExporting] = useState(false);
  const venueMap = new Map<string, DbVenue>(venues.map((v) => [v.id, v]));

  useEffect(() => {
    supabase
      .from("events")
      .select("*")
      .eq("status", "approved")
      .order("event_date")
      .then(({ data }) => {
        if (data) setApprovedEvents(data as DbEvent[]);
      });
  }, []);

  async function downloadCsv() {
    if (!selectedEventId) { toast.error("Select an event first."); return; }
    setExporting(true);
    try {
      const { data: passes } = await supabase
        .from("event_passes")
        .select("*")
        .eq("event_id", selectedEventId);

      const rollNos = (passes ?? []).map((p: Record<string, unknown>) => p.roll_no as string);
      let studentMap = new Map<string, DbStudent>();
      if (rollNos.length > 0) {
        const { data: students } = await supabase
          .from("college_student_registry")
          .select("*")
          .in("roll_no", rollNos);
        studentMap = new Map((students ?? []).map((s: DbStudent) => [s.roll_no, s]));
      }

      const ev = approvedEvents.find((e) => e.id === selectedEventId);
      const v = ev ? venueMap.get(ev.assigned_venue_id ?? ev.requested_venue_id) : undefined;
      const venueName = v?.name ?? "Campus";
      const dateTimeStr = ev ? `${fmtDate(ev.event_date)} ${fmtRange(ev.start_time, ev.end_time)}` : "—";

      const totalRegistered = (passes ?? []).length;
      const totalPresent = (passes ?? []).filter((p: Record<string, unknown>) => p.is_used).length;
      const absentCount = totalRegistered - totalPresent;
      const attendanceRatePct = totalRegistered > 0 ? Math.round((totalPresent / totalRegistered) * 100) : 0;

      const summary = [
        `"Event Title","${(ev?.title ?? "").replace(/"/g, '""')}"`,
        `"Venue","${venueName.replace(/"/g, '""')}"`,
        `"Date & Time","${dateTimeStr.replace(/"/g, '""')}"`,
        `"Total Registered (Passes Issued)",${totalRegistered}`,
        `"Total Present (Checked-In)",${totalPresent}`,
        `"Absent / No-Show",${absentCount}`,
        `"Attendance Rate (%)","${attendanceRatePct}%"`,
      ].join("\n");

      const header = "roll_no,full_name,branch,year,official_email,pass_token,attendance_status,scanned_at\n";
      const rows = (passes ?? [])
        .map((p: Record<string, unknown>) => {
          const s = studentMap.get(p.roll_no as string);
          const yearVal = (s as DbStudent & { year?: number })?.year ?? "";
          const attendanceStatus = p.is_used ? "PRESENT" : "ABSENT";
          return [
            p.roll_no,
            `"${(s?.full_name ?? "").replace(/"/g, '""')}"`,
            `"${(s?.branch ?? "").replace(/"/g, '""')}"`,
            yearVal,
            s?.official_email ?? "",
            p.pass_token,
            attendanceStatus,
            p.scanned_at ?? "",
          ].join(",");
        })
        .join("\n");

      const csvContent = summary + "\n\n" + header + rows;
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `KCC-Attendance-${ev?.title.replace(/\s+/g, "-") ?? selectedEventId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${totalRegistered} rows`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  const upcomingApproved = approvedEvents.filter((ev) => isEventActive(ev.event_date, ev.end_time));
  const pastApproved = approvedEvents.filter((ev) => !isEventActive(ev.event_date, ev.end_time));

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface shadow-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">Export Attendance CSV</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Download event summary metrics, pass-holders, and gate check-in timestamps for an event.
        </p>
      </div>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Event</label>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an approved event" />
            </SelectTrigger>
            <SelectContent>
              {upcomingApproved.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Upcoming Events
                  </SelectLabel>
                  {upcomingApproved.map((ev) => {
                    const venueId = ev.assigned_venue_id ?? ev.requested_venue_id;
                    return (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.title} — {fmtDate(ev.event_date)}{venueMap.get(venueId) ? ` · ${venueMap.get(venueId)!.name}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              )}
              {pastApproved.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Past Events
                  </SelectLabel>
                  {pastApproved.map((ev) => {
                    const venueId = ev.assigned_venue_id ?? ev.requested_venue_id;
                    return (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.title} — {fmtDate(ev.event_date)}{venueMap.get(venueId) ? ` · ${venueMap.get(venueId)!.name}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={downloadCsv} disabled={!selectedEventId || exporting} variant="outline">
          <Download /> {exporting ? "Exporting…" : "Download CSV"}
        </Button>
      </div>
    </section>
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────
const YEARS = ["1", "2", "3", "4"];
const emptyStudent = { roll: "", name: "", branch: "", year: "3", email: "", photo: "" };

function Registry({ onStudentAdded }: { onStudentAdded: () => void }) {
  const [students, setStudents] = useState<DbStudent[]>([]);
  const [form, setForm] = useState(emptyStudent);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof emptyStudent) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function loadStudents() {
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("college_student_registry")
        .select("*")
        .order("roll_no");
      if (error) throw error;
      setStudents((data as DbStudent[]) ?? []);
    } catch (err: unknown) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => { loadStudents(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.roll.trim() || !form.name.trim() || !form.branch || !form.email.trim()) {
      toast.error("Roll No, Name, Branch and Email are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("Enter a valid email.");
      return;
    }
    setSubmitting(true);
    try {
      const photoUrl =
        form.photo.trim() ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(form.name.trim())}`;
      const { error } = await supabase.from("college_student_registry").insert({
        roll_no: form.roll.trim().toUpperCase(),
        full_name: form.name.trim(),
        branch: form.branch,
        year: Number(form.year),
        official_email: form.email.trim().toLowerCase(),
        photo_url: photoUrl,
      });
      if (error) throw error;
      setForm(emptyStudent);
      toast.success("Student added to registry");
      loadStudents();
      onStudentAdded();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCsvImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    // skip header
    const dataLines = lines.slice(1).filter((l) => l.trim());
    if (dataLines.length === 0) { toast.error("No data rows found in CSV."); return; }

    const rows = dataLines.map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      return {
        roll_no: (cols[0] ?? "").toUpperCase(),
        full_name: cols[1] ?? "",
        branch: cols[2] ?? "",
        year: Number(cols[3] ?? "3") || 3,
        official_email: (cols[4] ?? "").toLowerCase(),
        photo_url: cols[5] ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cols[1] ?? "")}`,
      };
    }).filter((r) => r.roll_no && r.official_email);

    try {
      const { error } = await supabase
        .from("college_student_registry")
        .upsert(rows, { onConflict: "roll_no" });
      if (error) throw error;
      toast.success(`Imported ${rows.length} student${rows.length !== 1 ? "s" : ""}`);
      loadStudents();
      onStudentAdded();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    if (csvInputRef.current) csvInputRef.current.value = "";
  }

  async function deleteStudent(rollNo: string, name: string) {
    if (!window.confirm(`Delete ${name} (${rollNo}) from the ERP Student Registry?`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from("college_student_registry")
        .delete()
        .eq("roll_no", rollNo);

      if (error) {
        if (error.code === "23503" || error.message.toLowerCase().includes("foreign key")) {
          toast.error("Cannot delete student: Active event bookings or passes are linked to this roll number.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success(`Student ${rollNo} deleted from registry`);
      loadStudents();
      onStudentAdded();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  const toStudentPhotoShape = (s: DbStudent) => ({
    name: s.full_name,
    photo: s.photo_url ?? undefined,
  });

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">College ERP Student Registry</h2>
          <span className="text-xs text-muted-foreground">{students.length} students</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCsvImport}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
          >
            <Upload className="size-3.5" /> Import CSV
          </Button>
        </div>
      </div>

      {loadError && (
        <p className="flex items-center gap-2 px-5 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {loadError}
        </p>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 pl-5">Photo</TableHead>
              <TableHead>Roll No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Yr</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>College Email</TableHead>
              <TableHead className="w-12 pr-5 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.roll_no}>
                <TableCell className="pl-5">
                  <StudentPhoto student={toStudentPhotoShape(s)} className="size-9 rounded-full" />
                </TableCell>
                <TableCell className="font-mono text-xs">{s.roll_no}</TableCell>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{(s as DbStudent & { year?: number }).year ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{s.branch}</TableCell>
                <TableCell className="text-muted-foreground">{s.official_email}</TableCell>
                <TableCell className="pr-5 text-right">
                  <button
                    type="button"
                    onClick={() => deleteStudent(s.roll_no, s.full_name)}
                    title={`Delete ${s.full_name}`}
                    className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Inline add-student form */}
      <form
        onSubmit={submit}
        className="grid gap-2 border-t border-border bg-secondary/50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[6rem_1fr_8rem_8rem_1fr_1fr_auto]"
      >
        <Input
          aria-label="Roll No"
          value={form.roll}
          onChange={(e) => set("roll")(e.target.value)}
          placeholder="Roll No"
          className="bg-surface font-mono"
          required
        />
        <Input
          aria-label="Name"
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
          placeholder="Full name"
          className="bg-surface"
          required
        />
        <Select value={form.year} onValueChange={set("year")}>
          <SelectTrigger aria-label="Year" className="bg-surface">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>Year {y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={form.branch} onValueChange={set("branch")}>
          <SelectTrigger aria-label="Branch" className="bg-surface">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {BRANCHES.map((br) => (
              <SelectItem key={br} value={br}>{br}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="College Email"
          type="email"
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
          placeholder="name@kcc.edu.in"
          className="bg-surface"
          required
        />
        <Input
          aria-label="Photo URL"
          value={form.photo}
          onChange={(e) => set("photo")(e.target.value)}
          placeholder="Photo URL (auto-generated if blank)"
          className="bg-surface"
        />
        <Button type="submit" disabled={submitting}>
          <UserPlus /> {submitting ? "Adding…" : "Add"}
        </Button>
      </form>
    </section>
  );
}
