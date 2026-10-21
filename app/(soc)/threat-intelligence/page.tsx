import type { Metadata } from "next";

import { ModulePreview } from "@/components/dashboard/ModulePreview";
import { getModulePreview } from "@/lib/soc/modules";

export const metadata: Metadata = {
  title: "Threat Intelligence",
  description:
    "Live adversary signals, credential-stuffing infrastructure and exposure correlation.",
};

export default function ThreatIntelligencePage() {
  return <ModulePreview module={getModulePreview("threat-intelligence")} />;
}
