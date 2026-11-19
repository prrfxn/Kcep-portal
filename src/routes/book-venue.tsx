import { useState, type FormEvent } from "react";
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
import {
  normalizeRoll,
  respondToReassign,
  submitBooking,
  venueById,
  type Booking,
} from "@/lib/portal-logic";
import { getPortalState, newId, setPortalState, usePortal } from "@/lib/portal-store";
import { fmtDate, fmtRange } from "@/lib/portal-format";

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
  const state = usePortal();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState("22CS001");
  const set = (k: keyof typeof empty) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = submitBooking(
      getPortalState(),
      { ...form, expectedCrowd: Number(form.expectedCrowd) },
      newId("bk"),
      Date.now(),
    );
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPortalState(res.state);
    setError(null);
    setLookup(res.booking.organizerRoll);
    setForm(empty);
    toast.success("Venue request submitted", { description: "The admin will review it shortly." });
  }

  const roll = normalizeRoll(lookup);
  const mine = roll
    ? state.bookings
        .filter((b) => b.organizerRoll === roll)
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];
  const venue = venueById(state, form.venueId);

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
                placeholder="22CS001"
                required
              />
            </Field>
            <Field id="venue" label="Venue">
              <Select value={form.venueId} onValueChange={set("venueId")}>
                <SelectTrigger id="venue">
                  <SelectValue placeholder="Select a venue" />
                </SelectTrigger>
                <SelectContent>
                  {state.venues.map((v) => (
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
            hint={venue ? `Max ${venue.capacity} for ${venue.name}` : undefined}
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
          <Button type="submit" className="w-full">
            <Send /> Submit Request
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
            {mine.length === 0 ? (
              <div className="grid place-items-center rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                <Inbox className="mb-2 size-5" />
                {roll ? `No requests for ${roll}` : "Enter your roll number"}
              </div>
            ) : (
              mine.map((b) => <RequestItem key={b.id} booking={b} />)
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function RequestItem({ booking: b }: { booking: Booking }) {
  const state = usePortal();
  const venue = venueById(state, b.venueId);
  const newVenue = venueById(state, b.reassignedVenueId);
  const reassigned = b.status === "reassigned";

  function respond(accept: boolean) {
    const res = respondToReassign(getPortalState(), b.id, accept);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPortalState(res.state);
    toast.success(accept ? `Booked in ${newVenue?.name}` : "Request cancelled");
  }

  return (
    <div
      className={`rounded-lg border p-4 ${reassigned ? "border-warning/40 bg-warning-soft" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{b.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" />
              {fmtDate(b.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {fmtRange(b.startTime, b.endTime)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3" />
              {b.expectedCrowd}
            </span>
          </div>
        </div>
        <StatusBadge status={b.status} />
      </div>

      {reassigned && newVenue ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground line-through">{venue?.name}</span>
            <ArrowRight className="size-4 text-warning" />
            <span className="rounded-md border border-success/30 bg-success-soft px-2 py-0.5 font-semibold text-success">
              {newVenue.name}
            </span>
            <span className="text-xs text-muted-foreground">· {newVenue.capacity} seats</span>
          </div>
          {b.adminRemark && (
            <p className="flex gap-2 rounded-md bg-surface px-3 py-2 text-xs text-foreground">
              <MessageSquareQuote className="size-3.5 shrink-0 text-warning" />
              <span>
                <span className="font-medium">Admin:</span> {b.adminRemark}
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
          Venue: <span className="text-foreground">{venue?.name}</span>
          {b.adminRemark && b.status === "rejected" && (
            <p className="mt-1">Admin: {b.adminRemark}</p>
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
