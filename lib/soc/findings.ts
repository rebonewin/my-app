import type { Finding } from "@/types/dashboard";

export const FINDING_STATUS_META: Record<
  Finding["status"],
  {
    label: string;
    tone: "danger" | "medium" | "accent" | "success";
  }
> = {
  open: { label: "Open", tone: "danger" },
  triaged: { label: "Triaged", tone: "medium" },
  "in-progress": { label: "In progress", tone: "accent" },
  resolved: { label: "Resolved", tone: "success" },
};
