import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Clock, MapPin, Users, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/portal/PageHeading";
import { ClaimPassDialog } from "@/components/portal/ClaimPassDialog";
import { remainingSeats, totalSeats, venueById, type Booking } from "@/lib/portal-logic";
import { usePortal } from "@/lib/portal-store";
import { fmtDate, fmtDay, fmtMonth, fmtRange } from "@/lib/portal-format";

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

function EventsPage() {
  const state = usePortal();
  const [claiming, setClaiming] = useState<Booking | null>(null);
  const events = state.bookings
    .filter((b) => b.status === "approved")
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  return (
    <>
      <PageHeading
        title="Events & Passes"
        subtitle="Approved campus events. Claim a pass to get your QR entry ticket."
      />
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-sm text-muted-foreground">
          No approved events yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev) => {
            const total = totalSeats(state, ev);
            const left = remainingSeats(state, ev);
            const pct = total ? Math.round(((total - left) / total) * 100) : 100;
            return (
              <article
                key={ev.id}
                className="flex flex-col rounded-xl border border-border bg-surface p-5 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="grid w-12 shrink-0 place-items-center rounded-lg border border-border py-1.5 text-center leading-none">
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">
                      {fmtMonth(ev.date)}
                    </span>
                    <span className="mt-0.5 text-lg font-semibold">{fmtDay(ev.date)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold leading-snug">{ev.title}</h2>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {ev.description}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-1.5 text-sm">
                  <Row icon={MapPin} label={venueById(state, ev.venueId)?.name ?? "—"} />
                  <Row icon={CalendarDays} label={fmtDate(ev.date)} />
                  <Row icon={Clock} label={fmtRange(ev.startTime, ev.endTime)} />
                </dl>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Users className="size-3.5" /> Remaining seats
                    </span>
                    {left > 0 ? (
                      <Badge variant={left <= total * 0.1 ? "warning" : "success"}>
                        {left} / {total}
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
                  disabled={left === 0}
                  onClick={() => setClaiming(ev)}
                >
                  <Ticket /> Claim Entry Pass
                </Button>
              </article>
            );
          })}
        </div>
      )}
      <ClaimPassDialog booking={claiming} onClose={() => setClaiming(null)} />
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
