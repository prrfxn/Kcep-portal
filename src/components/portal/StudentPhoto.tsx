import { cn } from "@/lib/utils";
import type { Student } from "@/lib/portal-logic";

export function StudentPhoto({
  student,
  className,
}: {
  student?: Student | undefined;
  className?: string | undefined;
}) {
  const initials = (student?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className={cn("overflow-hidden rounded-lg bg-secondary", className)}>
      {student?.photo ? (
        <img
          src={student.photo}
          alt={`${student.name} official photo`}
          className="size-full object-cover"
        />
      ) : (
        <div className="grid size-full place-items-center text-lg font-semibold text-muted-foreground">
          {initials}
        </div>
      )}
    </div>
  );
}
