import { useState, useEffect } from "react";
import { Sun, Moon, ScanLine, ShieldCheck, Lock, GraduationCap } from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

// ── Types ────────────────────────────────────────────────────────────────────
export type Role = "student" | "gate" | "admin";

const ROLE_KEY = "kcc-role";
const THEME_KEY = "kcc-theme";

const PASSCODES: Record<Exclude<Role, "student">, string> = {
  gate: "GATE2026",
  admin: "KCC2026",
};

// ── Exported hook ─────────────────────────────────────────────────────────────
export function useRole(): Role {
  if (typeof window === "undefined") return "student";
  try {
    const stored = sessionStorage.getItem(ROLE_KEY) as Role | null;
    return stored ?? "student";
  } catch {
    return "student";
  }
}

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV_LINKS: Record<Role, { label: string; to: string }[]> = {
  student: [
    { label: "Events & Passes", to: "/" },
    { label: "Book Venue", to: "/book-venue" },
  ],
  gate: [
    { label: "Events & Passes", to: "/" },
    { label: "Book Venue", to: "/book-venue" },
    { label: "Gate Scanner", to: "/gate-scanner" },
  ],
  admin: [
    { label: "Events & Passes", to: "/" },
    { label: "Book Venue", to: "/book-venue" },
    { label: "Gate Scanner", to: "/gate-scanner" },
    { label: "Admin", to: "/admin" },
  ],
};

// ── Segment pill config ───────────────────────────────────────────────────────
const SEGMENTS: { role: Role; label: string; icon: React.ReactNode }[] = [
  { role: "student", label: "Student", icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { role: "gate", label: "Gate Staff", icon: <ScanLine className="h-3.5 w-3.5" /> },
  { role: "admin", label: "Admin", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function AppHeader() {
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  // ── Dark mode state ──────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark") {
        document.documentElement.classList.add("dark");
        setIsDark(true);
      }
    } catch {
      // ignore
    }
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    if (typeof document !== "undefined") {
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {
        // ignore
      }
    }
  }

  // ── Role state ───────────────────────────────────────────────────────────
  const [role, setRole] = useState<Role>("student");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = sessionStorage.getItem(ROLE_KEY) as Role | null;
      if (stored) {
        setRole(stored);
      }
    } catch {
      // ignore
    }
  }, []);

  // ── Passcode prompt state ────────────────────────────────────────────────
  const [pendingRole, setPendingRole] = useState<Exclude<Role, "student"> | null>(null);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);

  function handleSegmentClick(target: Role) {
    if (target === "student") {
      // Immediately switch, no prompt
      setPendingRole(null);
      setPasscode("");
      setPasscodeError(false);
      setRole("student");
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(ROLE_KEY, "student");
        } catch {
          // ignore
        }
      }
      // If stepping down from protected routes (/gate-scanner or /admin), redirect cleanly to "/"
      if (currentPath === "/gate-scanner" || currentPath === "/admin") {
        navigate({ to: "/" });
      }
      return;
    }
    if (target === role && pendingRole === null) {
      // Already on this role, no-op
      return;
    }
    // Show inline passcode prompt
    setPendingRole(target);
    setPasscode("");
    setPasscodeError(false);
  }

  function handlePasscodeConfirm() {
    if (!pendingRole) return;
    if (passcode === PASSCODES[pendingRole]) {
      const nextRole = pendingRole;
      setRole(nextRole);
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(ROLE_KEY, nextRole);
        } catch {
          // ignore
        }
      }
      setPendingRole(null);
      setPasscode("");
      setPasscodeError(false);

      // If stepping down from /admin to Gate Staff, redirect cleanly to "/"
      if (nextRole === "gate" && currentPath === "/admin") {
        navigate({ to: "/" });
      }
    } else {
      setPasscodeError(true);
    }
  }

  function handlePasscodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handlePasscodeConfirm();
    if (e.key === "Escape") {
      setPendingRole(null);
      setPasscode("");
      setPasscodeError(false);
    }
  }

  const navLinks = NAV_LINKS[role];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur dark:bg-surface/90 w-full max-w-full overflow-x-hidden">
      {/* ── Main bar ──────────────────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
        {/* Logo + title */}
        <Link to="/" className="flex shrink-0 items-center gap-2 hover:opacity-80 transition-opacity">
          <img src="/kcc-logo.png" alt="KCC Institute of Technology and Management" className="h-8 w-auto sm:h-9 rounded" />
          <span className="leading-tight">
            <span className="block text-xs sm:text-sm font-semibold tracking-tight">KCC Event &amp; Pass Portal</span>
            <span className="block text-[10px] sm:text-[11px] text-muted-foreground">Campus events · Venues · Entry</span>
          </span>
        </Link>

        {/* Controls: Segmented role switch + Theme toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Segmented role switch */}
          <div className="relative flex flex-col items-end">
            <div
              className="flex items-center rounded-lg border border-border bg-muted p-0.5 gap-0.5"
              role="group"
              aria-label="Switch role"
            >
              {SEGMENTS.map(({ role: seg, label, icon }) => {
                const isActive = role === seg && pendingRole === null;
                const isPending = pendingRole === seg;
                return (
                  <button
                    key={seg}
                    onClick={() => handleSegmentClick(seg)}
                    aria-pressed={isActive}
                    className={[
                      "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-xs font-medium transition-all whitespace-nowrap",
                      isActive
                        ? "bg-background text-foreground shadow-sm font-semibold"
                        : isPending
                        ? "bg-background/60 text-foreground ring-2 ring-primary/40"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50",
                    ].join(" ")}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Inline passcode prompt card */}
            {pendingRole !== null && (
              <div className="absolute top-full mt-2 right-0 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-background p-3 shadow-lg">
                <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-foreground">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Enter passcode for{" "}
                  <span className="text-primary">
                    {pendingRole === "gate" ? "Gate Staff" : "Admin"}
                  </span>
                </div>
                <input
                  type="password"
                  autoFocus
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (passcodeError) setPasscodeError(false);
                  }}
                  onKeyDown={handlePasscodeKeyDown}
                  placeholder="Passcode"
                  className="w-full rounded-md border border-border bg-muted px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2"
                />
                {passcodeError && (
                  <p className="text-xs text-red-500 mb-2">Incorrect passcode</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handlePasscodeConfirm}
                    className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => {
                      setPendingRole(null);
                      setPasscode("");
                      setPasscodeError(false);
                    }}
                    className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            {isDark ? <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>
        </div>
      </div>

      {/* ── Nav tabs ──────────────────────────────────────────────────────── */}
      <nav className="mx-auto max-w-7xl px-3 sm:px-4 pb-2 flex items-center gap-1 overflow-x-auto w-full min-w-0">
        {navLinks.map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            className="shrink-0 rounded-md px-2.5 py-1 text-xs sm:text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted [&.active]:text-foreground [&.active]:bg-muted [&.active]:font-semibold whitespace-nowrap"
            activeProps={{ className: "text-foreground bg-muted font-semibold" }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export default AppHeader;
