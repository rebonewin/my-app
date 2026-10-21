import type { Metadata } from "next";

import { ModulePreview } from "@/components/dashboard/ModulePreview";
import { getModulePreview } from "@/lib/soc/modules";

export const metadata: Metadata = {
  title: "Audit & Compliance",
  description:
    "Audit-ready evidence and control coverage across SOC 2, ISO 27001, GDPR and PCI DSS.",
};

export default function CompliancePage() {
  return <ModulePreview module={getModulePreview("compliance")} />;
}
