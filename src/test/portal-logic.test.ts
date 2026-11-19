import { describe, expect, it } from "vitest";
import {
  approveBooking,
  claimPass,
  reassignBooking,
  remainingSeats,
  respondToReassign,
  scanPass,
  submitBooking,
} from "@/lib/portal-logic";
import { seedState } from "@/lib/portal-seed";

const aarav = { roll: "22CS001", email: "aarav.sharma@kcc.edu.in" };

describe("entry passes", () => {
  it("rejects a claim whose email does not match the registry", () => {
    const res = claimPass(
      seedState,
      { roll: "22CS001", email: "someone@kcc.edu.in", bookingId: "bk-robo" },
      "T1",
      0,
    );
    expect(res.ok).toBe(false);
  });

  it("issues an active pass and takes one seat", () => {
    const before = remainingSeats(
      seedState,
      seedState.bookings.find((b) => b.id === "bk-robo")!,
    );
    const res = claimPass(seedState, { ...aarav, bookingId: "bk-robo" }, "T1", 0);
    if (!res.ok) throw new Error(res.error);
    expect(res.pass.status).toBe("active");
    expect(
      remainingSeats(
        res.state,
        res.state.bookings.find((b) => b.id === "bk-robo")!,
      ),
    ).toBe(before - 1);
  });

  it("returns the existing pass instead of a second one for the same event", () => {
    const first = claimPass(seedState, { ...aarav, bookingId: "bk-robo" }, "T1", 0);
    if (!first.ok) throw new Error(first.error);
    const again = claimPass(first.state, { ...aarav, bookingId: "bk-robo" }, "T2", 0);
    if (!again.ok) throw new Error(again.error);
    expect(again.existing).toBe(true);
    expect(again.pass.token).toBe("T1");
  });

  it("admits a pass once, then rejects it as already used", () => {
    const first = scanPass(seedState, "KCC-DEMO-PASS", 5);
    expect(first.result.kind).toBe("approved");
    const second = scanPass(first.state, "KCC-DEMO-PASS", 6);
    expect(second.result.kind).toBe("used");
  });
});

describe("venue requests", () => {
  const base = {
    title: "Clash test",
    description: "",
    organizerRoll: "22cs001",
    venueId: "main-aud",
    date: "2026-11-27",
    startTime: "11:00",
    endTime: "13:00",
    expectedCrowd: 100,
  };

  it("blocks a request overlapping an approved booking at the same venue", () => {
    expect(submitBooking(seedState, base, "x", 0).ok).toBe(false);
  });

  it("blocks a crowd larger than the venue capacity", () => {
    const res = submitBooking(seedState, { ...base, venueId: "lab-3", expectedCrowd: 41 }, "x", 0);
    expect(res.ok).toBe(false);
  });

  it("moves a booking to the new venue when the organizer accepts a reassignment", () => {
    const sent = reassignBooking(seedState, "bk-debate", "room-101", "Hall B is closed");
    if (!sent.ok) throw new Error(sent.error);
    const accepted = respondToReassign(sent.state, "bk-debate", true);
    if (!accepted.ok) throw new Error(accepted.error);
    const b = accepted.state.bookings.find((x) => x.id === "bk-debate")!;
    expect(b.status).toBe("approved");
    expect(b.venueId).toBe("room-101");
  });

  it("cancels the booking when the organizer declines a reassignment", () => {
    const res = respondToReassign(seedState, "bk-quiz", false);
    if (!res.ok) throw new Error(res.error);
    expect(res.state.bookings.find((x) => x.id === "bk-quiz")!.status).toBe("cancelled");
  });

  it("approves a pending request only once", () => {
    const res = approveBooking(seedState, "bk-ml");
    if (!res.ok) throw new Error(res.error);
    expect(approveBooking(res.state, "bk-ml").ok).toBe(false);
  });
});
