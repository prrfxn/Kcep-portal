import { useState, type FormEvent } from "react";
import { AlertCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PassCard } from "./PassCard";
import { supabase, type DbPass, type DbStudent, type DbVenue } from "@/lib/supabase";
import type { DbEvent } from "@/lib/supabase";

// Shape expected by PassCard / StudentPhoto - keep compatible
type PassCardEvent = {
  id: string;
  title: string;
  description: string;
  event_date: string;
  start_time: string;
  end_time: string;
};

type EventWithVenue = DbEvent & { venue?: DbVenue };

export function ClaimPassDialog({
  event,
  onClose,
}: {
  event: EventWithVenue | null;
  onClose: () => void;
}) {
  const [roll, setRoll] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pass, setPass] = useState<DbPass | null>(null);
  const [student, setStudent] = useState<DbStudent | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setRoll("");
    setEmail("");
    setError(null);
    setNotice(null);
    setPass(null);
    setStudent(null);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!event) return;
    setError(null);
    setSubmitting(true);

    const normalizedRoll = roll.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Verify student in registry
    const { data: studentData } = await supabase
      .from("college_student_registry")
      .select("*")
      .eq("roll_no", normalizedRoll)
      .maybeSingle();

    if (!studentData) {
      setError("Roll number not found in the College ERP registry.");
      setSubmitting(false);
      return;
    }

    const st = studentData as DbStudent;
    if (st.official_email.toLowerCase() !== normalizedEmail) {
      setError("College email does not match the registry record.");
      setSubmitting(false);
      return;
    }

    // Check for existing pass
    const { data: existing } = await supabase
      .from("event_passes")
      .select("*")
      .eq("event_id", event.id)
      .eq("roll_no", normalizedRoll)
      .maybeSingle();

    if (existing) {
      setStudent(st);
      setPass(existing as DbPass);
      setNotice("You already claimed a pass for this event — here it is.");
      setSubmitting(false);
      return;
    }

    // Check seats remaining
    const capacity = event.venue?.capacity ?? event.expected_crowd;
    const totalSeats = Math.min(event.expected_crowd, capacity);
    const { count } = await supabase
      .from("event_passes")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id);
    const used = count ?? 0;
    if (used >= totalSeats) {
      setError("No seats left for this event.");
      setSubmitting(false);
      return;
    }

    // Insert new pass — omit pass_token so Postgres generates a valid UUID via DEFAULT gen_random_uuid()
    const { data: newPass, error: insertError } = await supabase
      .from("event_passes")
      .insert({
        event_id: event.id,
        roll_no: normalizedRoll,
        is_used: false,
        scanned_at: null,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    setStudent(st);
    setPass(newPass as DbPass);
    setNotice(null);
    setSubmitting(false);
  }

  // Adapt for PassCard
  const studentShape = student
    ? {
        roll: student.roll_no,
        name: student.full_name,
        branch: student.branch,
        email: student.official_email,
        photo: student.photo_url ?? undefined,
      }
    : undefined;

  const passShape = pass
    ? {
        token: pass.pass_token,
        roll: pass.roll_no,
        bookingId: pass.event_id,
        status: (pass.is_used ? "used" : "active") as "active" | "used",
        claimedAt: new Date(pass.claimed_at).getTime(),
        usedAt: pass.scanned_at ? new Date(pass.scanned_at).getTime() : undefined,
      }
    : null;

  const bookingShape = event
    ? {
        id: event.id,
        title: event.title,
        description: event.description,
        organizerRoll: event.organizer_roll_no,
        venueId: event.assigned_venue_id ?? event.requested_venue_id,
        date: event.event_date,
        startTime: event.start_time,
        endTime: event.end_time,
        expectedCrowd: event.expected_crowd,
        status: event.status as "approved",
        createdAt: new Date(event.created_at).getTime(),
      }
    : undefined;

  const venueShape = event?.venue
    ? {
        id: event.venue.id,
        name: event.venue.name,
        capacity: event.venue.capacity,
        kind: event.venue.kind,
      }
    : undefined;

  return (
    <Dialog open={!!event} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        {passShape && bookingShape ? (
          <>
            <DialogHeader>
              <DialogTitle>Your entry pass</DialogTitle>
              <DialogDescription>Show this QR code at the gate. It works once.</DialogDescription>
            </DialogHeader>
            {notice && (
              <p className="flex items-center gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                <Info className="size-3.5" /> {notice}
              </p>
            )}
            <PassCard
              pass={passShape}
              student={studentShape}
              booking={bookingShape}
              venue={venueShape}
            />
            <Button variant="outline" onClick={close}>
              Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Claim Entry Pass</DialogTitle>
              <DialogDescription>{event?.title}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="claim-roll">Roll Number</Label>
                <Input
                  id="claim-roll"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  placeholder="e.g. 2404920310001"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="claim-email">College Email</Label>
                <Input
                  id="claim-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@kcc.edu.in"
                  required
                />
              </div>
              {error && (
                <p className="flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="size-3.5 shrink-0" /> {error}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Verified against the College ERP registry.
              </p>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Verifying…" : "Generate Pass"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
