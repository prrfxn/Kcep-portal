import { useState, useEffect, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Inbox,
  MessageSquareQuote,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeading } from "@/components/portal/PageHeading";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { normalizeRoll } from "@/lib/portal-logic";
import { fmtDate, fmtRange } from "@/lib/portal-format";
import { supabase, timesOverlap, type DbEvent, type DbVenue } from "@/lib/supabase";

export const Route = createFileRoute("/book-venue")({
  head: () => ({
    meta: [
      { title: "Book Venue · KCC Event & Pass Portal" },
      {
        name: "description",
        content: "Request a KCC campus venue for your event and track your booking requests.",
      },
      { property: "og:title", content: "Book Venue · KCC Event & Pass Portal" },
      {
        property: "og:description",
        content: "Request a KCC campus venue for your event and track your booking requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookVenuePage,
});

const empty = {
  title: "",
  description: "",
  organizerRoll: "",
  venueId: "",
  date: "",
  startTime: "",
  endTime: "",
  expectedCrowd: "",
};

function BookVenuePage() {
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [myEvents, setMyEvents] = useState<DbEvent[]>([]);
  const [myEventsError, setMyEventsError] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lookup, setLookup] = useState("");
  const set = (k: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Build a stable venue map for child rows — no extra fetches needed
  const venueMap = new Map<string, DbVenue>(venues.map((v) => [v.id, v]));

  // Load venues once
  useEffect(() => {
    supabase
      .from("venues")
      .select("*")
      .order("name")
      .then(({ data, error }) => {
        if (!error && data) setVenues(data as DbVenue[]);
      });
  }, []);

  // Load my bookings when lookup roll changes
  useEffect(() => {
    const roll = normalizeRoll(lookup);
    if (!roll) {
      setMyEvents([]);
      return;
    }
    setMyEventsError(null);
    supabase
      .from("events")
      .select("*")
      .eq("organizer_roll_no", roll)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setMyEventsError(error.message);
        } else {
          setMyEvents((data as DbEvent[]) ?? []);
        }
      });
  }, [lookup]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const venueId = form.venueId;
    const venue = venueMap.get(venueId);
    if (!venue) {
      setError("Choose a venue.");
      return;
    }
    if (form.endTime <= form.startTime) {
      setError("End time must be after start time.");
      return;
    }
    const crowd = Number(form.expectedCrowd);
    if (!(crowd > 0)) {
      setError("Expected crowd must be at least 1.");
      return;
    }
    if (crowd > venue.capacity) {
      setError(`${venue.name} seats only ${venue.capacity}.`);
      return;
    }

    setSubmitting(true);

    // Verify organizer roll exists in college_student_registry
    const normalizedRoll = normalizeRoll(form.organizerRoll);
    try {
      const { data: studentData, error: studentError } = await supabase
        .from("college_student_registry")
        .select("roll_no")
        .eq("roll_no", normalizedRoll)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!studentData) {
        setError("Roll number not found in College ERP Registry.");
        setSubmitting(false);
        return;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      return;
    }

    // Fetch events for same venue+date to check conflicts (separate query, no ambiguous join)
    try {
      const { data: sameDay, error: fetchError } = await supabase
        .from("events")
        .select("id, title, start_time, end_time, assigned_venue_id, requested_venue_id")
        .in("status", ["approved", "reassigned"])
        .eq("event_date", form.date);

      if (fetchError) throw fetchError;

      const clash = (sameDay ?? []).find((c) => {
        const effectiveVenue = c.assigned_venue_id ?? c.requested_venue_id;
        return (
          effectiveVenue === venueId &&
          timesOverlap(form.startTime, form.endTime, c.start_time, c.end_time)
        );
      });

      if (clash) {
        setError(`${venue.name} is already booked for "${clash.title}" in that slot.`);
        setSubmitting(false);
        return;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      return;
    }

    // Insert event
    try {
      const { error: insertError } = await supabase.from("events").insert({
        title: form.title.trim(),
        description: form.description.trim(),
        organizer_roll_no: normalizedRoll,
        requested_venue_id: venueId,
        assigned_venue_id: null,
        event_date: form.date,
        start_time: form.startTime,
        end_time: form.endTime,
        expected_crowd: crowd,
        status: "pending",
      });
      if (insertError) throw insertError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
      return;
    }

    // Success: reset form, update lookup filter to submitted roll number
    setForm(empty);
    setLookup(normalizedRoll);
    toast.success("Venue request submitted", { description: "The admin will review it shortly." });
    setSubmitting(false);
  }

  const selectedVenue = venueMap.get(form.venueId);
  const roll = normalizeRoll(lookup);

  return (
    <>
      <PageHeading
        title="Book Venue"
        subtitle="Request a hall or classroom for your event. The admin approves, reassigns or rejects it."
      />
      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6"
        >
          <h2 className="text-sm font-semibold">New venue request</h2>
          <Field id="title" label="Event Title">
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title")(e.target.value)}
              placeholder="e.g. Coding Club Meetup"
              required
            />
          </Field>
          <Field id="desc" label="Description">
            <Textarea
              id="desc"
              rows={3}
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="What's the event about?"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="org" label="Organizer Roll No">
              <Input
                id="org"
                value={form.organizerRoll}
                onChange={(e) => set("organizerRoll")(e.target.value)}
                placeholder="e.g. 2404920310001"
                required
              />
            </Field>
            <Field id="venue" label="Venue">
              <Select value={form.venueId} onValueChange={set("venueId")}>
                <SelectTrigger id="venue">
                  <SelectValue placeholder="Select a venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} · {v.capacity} seats
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="date" label="Date">
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) => set("date")(e.target.value)}
                required
              />
            </Field>
            <Field id="start" label="Start Time">
              <Input
                id="start"
                type="time"
                value={form.startTime}
                onChange={(e) => set("startTime")(e.target.value)}
                required
              />
            </Field>
            <Field id="end" label="End Time">
              <Input
                id="end"
                type="time"
                value={form.endTime}
                onChange={(e) => set("endTime")(e.target.value)}
                required
              />
            </Field>
          </div>
          <Field
            id="crowd"
            label="Expected Crowd"
            hint={selectedVenue ? `Max ${selectedVenue.capacity} for ${selectedVenue.name}` : undefined}
          >
            <Input
              id="crowd"
              type="number"
              min={1}
              value={form.expectedCrowd}
              onChange={(e) => set("expectedCrowd")(e.target.value)}
              placeholder="100"
              required
            />
          </Field>
          {error && (
            <p className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" /> {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            <Send /> {submitting ? "Submitting…" : "Submit Request"}
          </Button>
        </form>

        <section className="rounded-xl border border-border bg-surface p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">My Booking Requests</h2>
            <div className="flex items-center gap-2">
              <Label htmlFor="lookup" className="text-xs text-muted-foreground">
                Organizer Roll No
              </Label>
              <Input
                id="lookup"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                className="h-8 w-32 font-mono text-xs"
              />
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {myEventsError ? (
              <p className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" /> {myEventsError}
              </p>
            ) : myEvents.length === 0 ? (
              <div className="grid place-items-center rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                <Inbox className="mb-2 size-5" />
                {roll ? `No requests for ${roll}` : "Enter your roll number"}
              </div>
            ) : (
              myEvents.map((ev) => (
                <RequestItem
                  key={ev.id}
                  event={ev}
                  venueMap={venueMap}
                  onRefresh={() => setLookup((r) => r + "")}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function RequestItem({
  event: ev,
  venueMap,
  onRefresh,
}: {
  event: DbEvent;
  venueMap: Map<string, DbVenue>;
  onRefresh: () => void;
}) {
  const reqVenue = venueMap.get(ev.requested_venue_id);
  const assignedVenue = ev.assigned_venue_id ? venueMap.get(ev.assigned_venue_id) : undefined;
  const reassigned = ev.status === "reassigned";

  async function respond(accept: boolean) {
    try {
      const { error } = await supabase
        .from("events")
        .update({ status: accept ? "approved" : "cancelled" })
        .eq("id", ev.id);
      if (error) throw error;
      if (accept) {
        toast.success(`Booked in ${assignedVenue?.name ?? "reassigned venue"}`);
      } else {
        toast("Request cancelled");
      }
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 ${reassigned ? "border-warning/40 bg-warning-soft" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{ev.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {fmtDate(ev.event_date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {fmtRange(ev.start_time, ev.end_time)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {ev.expected_crowd}
            </span>
          </div>
        </div>
        <StatusBadge status={ev.status} />
      </div>

      {reassigned && assignedVenue ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground line-through">{reqVenue?.name}</span>
            <ArrowRight className="size-4 text-warning" />
            <span className="rounded-md border border-success/30 bg-success-soft px-2 py-0.5 font-semibold text-success">
              {assignedVenue.name}
            </span>
            <span className="text-xs text-muted-foreground">· {assignedVenue.capacity} seats</span>
          </div>
          {ev.admin_remark && (
            <p className="flex gap-2 rounded-md bg-surface px-3 py-2 text-xs text-foreground">
              <MessageSquareQuote className="size-3.5 shrink-0 text-warning" />
              <span>
                <span className="font-medium">Admin:</span> {ev.admin_remark}
              </span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="success" onClick={() => respond(true)}>
              <Check /> Accept Reassigned Venue
            </Button>
            <Button size="sm" variant="danger-outline" onClick={() => respond(false)}>
              <X /> Decline & Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">
          Venue: <span className="text-foreground">{reqVenue?.name ?? ev.requested_venue_id}</span>
          {ev.admin_remark && ev.status === "rejected" && (
            <p className="mt-1">Admin: {ev.admin_remark}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
