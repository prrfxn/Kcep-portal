import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/portal-logic";

const map: Record<
  BookingStatus,
  { label: string; variant: "success" | "warning" | "danger" | "neutral" }
> = {
  pending: { label: "Pending", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  reassigned: { label: "Reassigned", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}
