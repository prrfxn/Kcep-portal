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
import { claimPass, venueById, type Booking, type Pass } from "@/lib/portal-logic";
import { getPortalState, newPassToken, setPortalState, usePortal } from "@/lib/portal-store";

export function ClaimPassDialog({
  booking,
  onClose,
}: {
  booking: Booking | null;
  onClose: () => void;
}) {
  const state = usePortal();
  const [roll, setRoll] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pass, setPass] = useState<Pass | null>(null);

  function close() {
    setRoll("");
    setEmail("");
    setError(null);
    setNotice(null);
    setPass(null);
    onClose();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!booking) return;
    const res = claimPass(
      getPortalState(),
      { roll, email, bookingId: booking.id },
      newPassToken(),
      Date.now(),
    );
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPortalState(res.state);
    setError(null);
    setNotice(res.existing ? "You already claimed a pass for this event — here it is." : null);
    setPass(res.pass);
  }

  const livePass = pass ? (state.passes.find((p) => p.token === pass.token) ?? pass) : null;
  const student = livePass ? state.students.find((s) => s.roll === livePass.roll) : undefined;

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        {livePass && booking ? (
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
              pass={livePass}
              student={student}
              booking={booking}
              venue={venueById(state, booking.venueId)}
            />
            <Button variant="outline" onClick={close}>
              Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Claim Entry Pass</DialogTitle>
              <DialogDescription>{booking?.title}</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="claim-roll">Roll Number</Label>
                <Input
                  id="claim-roll"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  placeholder="e.g. 22CS001"
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
                Verified against the College ERP registry. Try{" "}
                <span className="font-mono">22CS001</span> /{" "}
                <span className="font-mono">aarav.sharma@kcc.edu.in</span>.
              </p>
              <Button type="submit" className="w-full">
                Generate Pass
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
