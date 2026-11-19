// Pure portal rules. Every function takes a state and returns a new one, so the
// browser store and the tests share exactly the same behaviour.

export type Venue = { id: string; name: string; capacity: number; kind: string };

export type Student = {
  roll: string;
  name: string;
  branch: string;
  email: string;
  photo?: string | undefined;
};

export type BookingStatus = "pending" | "approved" | "rejected" | "reassigned" | "cancelled";

export type Booking = {
  id: string;
  title: string;
  description: string;
  organizerRoll: string;
  venueId: string;
  date: string; // yyyy-mm-dd
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  expectedCrowd: number;
  status: BookingStatus;
  reassignedVenueId?: string | undefined;
  adminRemark?: string | undefined;
  createdAt: number;
};

export type Pass = {
  token: string;
  roll: string;
  bookingId: string;
  status: "active" | "used";
  claimedAt: number;
  usedAt?: number | undefined;
};

export type PortalState = {
  venues: Venue[];
  students: Student[];
  bookings: Booking[];
  passes: Pass[];
};

type Fail = { ok: false; error: string };

export const normalizeRoll = (roll: string) => roll.trim().toUpperCase();
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function venueById(state: PortalState, id: string | undefined) {
  return state.venues.find((v) => v.id === id);
}

export function totalSeats(state: PortalState, booking: Booking) {
  const venue = venueById(state, booking.venueId);
  return venue ? Math.min(booking.expectedCrowd, venue.capacity) : booking.expectedCrowd;
}

export function remainingSeats(state: PortalState, booking: Booking) {
  const claimed = state.passes.filter((p) => p.bookingId === booking.id).length;
  return Math.max(0, totalSeats(state, booking) - claimed);
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

/** An approved booking already holding this venue for an overlapping slot. */
export function findConflict(
  state: PortalState,
  venueId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeId?: string | undefined,
) {
  return state.bookings.find(
    (b) =>
      b.id !== excludeId &&
      b.status === "approved" &&
      b.venueId === venueId &&
      b.date === date &&
      timesOverlap(startTime, endTime, b.startTime, b.endTime),
  );
}

export type BookingInput = Omit<
  Booking,
  "id" | "status" | "createdAt" | "reassignedVenueId" | "adminRemark"
>;

export function submitBooking(
  state: PortalState,
  input: BookingInput,
  id: string,
  now: number,
): { ok: true; state: PortalState; booking: Booking } | Fail {
  if (!input.title.trim()) return { ok: false, error: "Event title is required." };
  if (!input.organizerRoll.trim())
    return { ok: false, error: "Organizer roll number is required." };
  const venue = venueById(state, input.venueId);
  if (!venue) return { ok: false, error: "Choose a venue." };
  if (!input.date || !input.startTime || !input.endTime)
    return { ok: false, error: "Date, start time and end time are required." };
  if (input.endTime <= input.startTime)
    return { ok: false, error: "End time must be after start time." };
  if (!(input.expectedCrowd > 0)) return { ok: false, error: "Expected crowd must be at least 1." };
  if (input.expectedCrowd > venue.capacity)
    return { ok: false, error: `${venue.name} seats only ${venue.capacity}.` };
  const clash = findConflict(state, input.venueId, input.date, input.startTime, input.endTime);
  if (clash)
    return {
      ok: false,
      error: `${venue.name} is already booked for "${clash.title}" in that slot.`,
    };

  const booking: Booking = {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    organizerRoll: normalizeRoll(input.organizerRoll),
    id,
    status: "pending",
    createdAt: now,
  };
  return { ok: true, booking, state: { ...state, bookings: [booking, ...state.bookings] } };
}

function updateBooking(state: PortalState, id: string, patch: Partial<Booking>): PortalState {
  return { ...state, bookings: state.bookings.map((b) => (b.id === id ? { ...b, ...patch } : b)) };
}

export function approveBooking(
  state: PortalState,
  id: string,
): { ok: true; state: PortalState } | Fail {
  const b = state.bookings.find((x) => x.id === id);
  if (!b || b.status !== "pending") return { ok: false, error: "Request is no longer pending." };
  const clash = findConflict(state, b.venueId, b.date, b.startTime, b.endTime, b.id);
  if (clash) return { ok: false, error: `Clashes with "${clash.title}". Reassign it instead.` };
  return { ok: true, state: updateBooking(state, id, { status: "approved" }) };
}

export function rejectBooking(state: PortalState, id: string, remark?: string): PortalState {
  return updateBooking(state, id, { status: "rejected", adminRemark: remark?.trim() || undefined });
}

export function reassignBooking(
  state: PortalState,
  id: string,
  venueId: string,
  remark: string,
): { ok: true; state: PortalState } | Fail {
  const b = state.bookings.find((x) => x.id === id);
  if (!b || b.status !== "pending") return { ok: false, error: "Request is no longer pending." };
  const venue = venueById(state, venueId);
  if (!venue) return { ok: false, error: "Choose a venue to reassign to." };
  if (venueId === b.venueId)
    return { ok: false, error: "Pick a different venue, or approve as requested." };
  if (!remark.trim()) return { ok: false, error: "Add a remark for the organizer." };
  const clash = findConflict(state, venueId, b.date, b.startTime, b.endTime, b.id);
  if (clash)
    return { ok: false, error: `${venue.name} is taken by "${clash.title}" in that slot.` };
  return {
    ok: true,
    state: updateBooking(state, id, {
      status: "reassigned",
      reassignedVenueId: venueId,
      adminRemark: remark.trim(),
    }),
  };
}

export function respondToReassign(
  state: PortalState,
  id: string,
  accept: boolean,
): { ok: true; state: PortalState } | Fail {
  const b = state.bookings.find((x) => x.id === id);
  if (!b || b.status !== "reassigned" || !b.reassignedVenueId)
    return { ok: false, error: "This request is not awaiting your response." };
  if (!accept) return { ok: true, state: updateBooking(state, id, { status: "cancelled" }) };
  const clash = findConflict(state, b.reassignedVenueId, b.date, b.startTime, b.endTime, b.id);
  if (clash) return { ok: false, error: `That venue was just taken by "${clash.title}".` };
  return {
    ok: true,
    state: updateBooking(state, id, { status: "approved", venueId: b.reassignedVenueId }),
  };
}

export function claimPass(
  state: PortalState,
  input: { roll: string; email: string; bookingId: string },
  token: string,
  now: number,
): { ok: true; state: PortalState; pass: Pass; existing: boolean } | Fail {
  const roll = normalizeRoll(input.roll);
  const student = state.students.find((s) => s.roll === roll);
  if (!student) return { ok: false, error: "Roll number not found in the College ERP registry." };
  if (normalizeEmail(student.email) !== normalizeEmail(input.email))
    return { ok: false, error: "College email does not match the registry record." };
  const booking = state.bookings.find((b) => b.id === input.bookingId);
  if (!booking || booking.status !== "approved")
    return { ok: false, error: "This event is not open for passes." };
  const existing = state.passes.find((p) => p.bookingId === booking.id && p.roll === roll);
  if (existing) return { ok: true, state, pass: existing, existing: true };
  if (remainingSeats(state, booking) <= 0)
    return { ok: false, error: "No seats left for this event." };
  const pass: Pass = { token, roll, bookingId: booking.id, status: "active", claimedAt: now };
  return { ok: true, pass, existing: false, state: { ...state, passes: [pass, ...state.passes] } };
}

export type ScanResult =
  | { kind: "approved"; pass: Pass; student?: Student | undefined; booking?: Booking | undefined }
  | { kind: "used"; pass: Pass; student?: Student | undefined; booking?: Booking | undefined }
  | { kind: "invalid"; token: string };

export function scanPass(
  state: PortalState,
  rawToken: string,
  now: number,
): { state: PortalState; result: ScanResult } {
  const token = rawToken.trim().toUpperCase();
  const pass = state.passes.find((p) => p.token === token);
  if (!pass) return { state, result: { kind: "invalid", token } };
  const student = state.students.find((s) => s.roll === pass.roll);
  const booking = state.bookings.find((b) => b.id === pass.bookingId);
  if (pass.status === "used") return { state, result: { kind: "used", pass, student, booking } };
  const used: Pass = { ...pass, status: "used", usedAt: now };
  return {
    state: { ...state, passes: state.passes.map((p) => (p.token === token ? used : p)) },
    result: { kind: "approved", pass: used, student, booking },
  };
}

export function addStudent(
  state: PortalState,
  input: Student,
): { ok: true; state: PortalState } | Fail {
  const roll = normalizeRoll(input.roll);
  if (!roll || !input.name.trim() || !input.branch.trim() || !input.email.trim())
    return { ok: false, error: "Roll No, Name, Branch and Email are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
    return { ok: false, error: "Enter a valid email." };
  if (state.students.some((s) => s.roll === roll))
    return { ok: false, error: `${roll} is already in the registry.` };
  const student: Student = {
    roll,
    name: input.name.trim(),
    branch: input.branch.trim(),
    email: normalizeEmail(input.email),
    photo: input.photo?.trim() || undefined,
  };
  return { ok: true, state: { ...state, students: [...state.students, student] } };
}
