import type { Finding } from "@/types/dashboard";

export const FINDING_STATUS_META: Record<
  Finding["status"],
  {
    label: string;
    tone: "danger" | "medium" | "accent" | "success" | "neutral";
  }
> = {
  open: { label: "Open", tone: "danger" },
  "in-progress": { label: "In progress", tone: "accent" },
  resolved: { label: "Resolved", tone: "success" },
  "accepted-risk": { label: "Accepted risk", tone: "neutral" },
};
