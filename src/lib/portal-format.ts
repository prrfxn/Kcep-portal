import { format, parse, parseISO } from "date-fns";

export const fmtDate = (d: string) => format(parseISO(d), "EEE, d MMM yyyy");
export const fmtDay = (d: string) => format(parseISO(d), "d");
export const fmtMonth = (d: string) => format(parseISO(d), "MMM");
export const fmtTime = (t: string) => format(parse(t, "HH:mm", new Date(2000, 0, 1)), "h:mm a");
export const fmtRange = (a: string, b: string) => `${fmtTime(a)} – ${fmtTime(b)}`;
