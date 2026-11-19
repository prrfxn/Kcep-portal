import { Link } from "@tanstack/react-router";
import { CalendarCheck, Building2, ScanLine, ShieldCheck, Ticket } from "lucide-react";

const tabs = [
  { to: "/", label: "Events & Passes", icon: CalendarCheck },
  { to: "/book-venue", label: "Book Venue", icon: Building2 },
  { to: "/gate-scanner", label: "Gate Scanner", icon: ScanLine },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
] as const;

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Ticket className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight">
              KCC Event & Pass Portal
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Campus events · Venues · Entry
            </span>
          </span>
        </Link>
        <nav className="-mx-1 flex gap-1 overflow-x-auto">
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
