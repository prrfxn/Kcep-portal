import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  Clock,
  MapPin,
  Repeat,
  RotateCcw,
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
  SelectItem,
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
import {
  addStudent,
  approveBooking,
  reassignBooking,
  rejectBooking,
  venueById,
  type Booking,
} from "@/lib/portal-logic";
import { getPortalState, resetPortalDemo, setPortalState, usePortal } from "@/lib/portal-store";
import { BRANCHES } from "@/lib/portal-seed";
import { fmtDate, fmtRange } from "@/lib/portal-format";

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

function AdminPage() {
  const state = usePortal();
  const pending = state.bookings
    .filter((b) => b.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt);

  return (
    <>
      <PageHeading
        title="Admin"
        subtitle="Review venue requests and maintain the student registry."
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              resetPortalDemo();
              toast.success("Demo data restored");
            }}
          >
            <RotateCcw /> Reset demo data
          </Button>
        }
      />

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
            {pending.map((b) => (
              <PendingRow key={b.id} booking={b} />
            ))}
          </ul>
        )}
      </section>

      <Registry />
    </>
  );
}

function PendingRow({ booking: b }: { booking: Booking }) {
  const state = usePortal();
  const [reassigning, setReassigning] = useState(false);
  const [venueId, setVenueId] = useState("");
  const [remark, setRemark] = useState("");

  function approve() {
    const res = approveBooking(getPortalState(), b.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPortalState(res.state);
    toast.success(`Approved "${b.title}"`);
  }
  function reject() {
    setPortalState(rejectBooking(getPortalState(), b.id));
    toast(`Rejected "${b.title}"`);
  }
  function reassign(e: FormEvent) {
    e.preventDefault();
    const res = reassignBooking(getPortalState(), b.id, venueId, remark);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPortalState(res.state);
    toast.success(`Sent reassignment to ${b.organizerRoll}`);
  }

  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{b.title}</p>
          {b.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{b.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono text-foreground">{b.organizerRoll}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {venueById(state, b.venueId)?.name}
            </span>
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
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="success" onClick={approve}>
            <Check /> Approve
          </Button>
          <Button
            size="sm"
            variant={reassigning ? "secondary" : "outline"}
            onClick={() => setReassigning((r) => !r)}
          >
            <Repeat /> Reassign
          </Button>
          <Button size="sm" variant="danger-outline" onClick={reject}>
            <X /> Reject
          </Button>
        </div>
      </div>
      {reassigning && (
        <form
          onSubmit={reassign}
          className="mt-3 flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 sm:flex-row"
        >
          <Select value={venueId} onValueChange={setVenueId}>
            <SelectTrigger className="bg-surface sm:w-60">
              <SelectValue placeholder="New venue" />
            </SelectTrigger>
            <SelectContent>
              {state.venues.map((v) => (
                <SelectItem key={v.id} value={v.id} disabled={v.id === b.venueId}>
                  {v.name} · {v.capacity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Remark for the organizer"
            className="flex-1 bg-surface"
          />
          <Button type="submit" size="default">
            Send
          </Button>
        </form>
      )}
    </li>
  );
}

const emptyStudent = { roll: "", name: "", branch: "", email: "", photo: "" };

function Registry() {
  const state = usePortal();
  const [form, setForm] = useState(emptyStudent);
  const set = (k: keyof typeof emptyStudent) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    const res = addStudent(getPortalState(), form);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setPortalState(res.state);
    setForm(emptyStudent);
    toast.success("Student added to registry");
  }

  return (
    <section className="mt-8 rounded-xl border border-border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">College ERP Student Registry</h2>
        <span className="text-xs text-muted-foreground">{state.students.length} students</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 pl-5">Photo</TableHead>
              <TableHead>Roll No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead className="pr-5">College Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.students.map((s) => (
              <TableRow key={s.roll}>
                <TableCell className="pl-5">
                  <StudentPhoto student={s} className="size-9 rounded-full" />
                </TableCell>
                <TableCell className="font-mono text-xs">{s.roll}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.branch}</TableCell>
                <TableCell className="pr-5 text-muted-foreground">{s.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <form
        onSubmit={submit}
        className="grid gap-2 border-t border-border bg-secondary/50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[7rem_1fr_11rem_1fr_1fr_auto]"
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
        <Select value={form.branch} onValueChange={set("branch")}>
          <SelectTrigger aria-label="Branch" className="bg-surface">
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {BRANCHES.map((br) => (
              <SelectItem key={br} value={br}>
                {br}
              </SelectItem>
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
          placeholder="Photo URL (optional)"
          className="bg-surface"
        />
        <Button type="submit">
          <UserPlus /> Add
        </Button>
      </form>
    </section>
  );
}
