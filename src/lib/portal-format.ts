import { format, parse, parseISO } from "date-fns";

export const fmtDate = (d: string) => format(parseISO(d.slice(0, 10)), "EEE, d MMM yyyy");
export const fmtDay = (d: string) => format(parseISO(d.slice(0, 10)), "d");
export const fmtMonth = (d: string) => format(parseISO(d.slice(0, 10)), "MMM");
// Postgres TIME columns return "HH:MM:SS" — slice to "HH:MM" before parsing.
export const fmtTime = (t: string) =>
  format(parse(t.slice(0, 5), "HH:mm", new Date(2000, 0, 1)), "h:mm a");
export const fmtRange = (a: string, b: string) => `${fmtTime(a)} – ${fmtTime(b)}`;
