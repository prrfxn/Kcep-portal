import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── DB row types matching the Supabase schema ───────────────────────────────

export type DbVenue = {
  id: string;
  name: string;
  capacity: number;
  kind: string;
};

export type DbStudent = {
  roll_no: string;
  full_name: string;
  branch: string;
  official_email: string;
  photo_url: string | null;
};

export type EventStatus = "pending" | "approved" | "rejected" | "reassigned" | "cancelled";

export type DbEvent = {
  id: string;
  title: string;
  description: string;
  organizer_roll_no: string;
  requested_venue_id: string;
  assigned_venue_id: string | null;
  event_date: string;
  start_time: string;
  end_time: string;
  expected_crowd: number;
  status: EventStatus;
  admin_remark: string | null;
  created_at: string;
};

export type DbPass = {
  id: string;
  event_id: string;
  roll_no: string;
  pass_token: string;
  is_used: boolean;
  scanned_at: string | null;
  claimed_at: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function newPassToken(): string {
  return crypto.randomUUID();
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}
