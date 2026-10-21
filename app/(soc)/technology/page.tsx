import type { Metadata } from "next";

import { ModulePreview } from "@/components/dashboard/ModulePreview";
import { getModulePreview } from "@/lib/soc/modules";

export const metadata: Metadata = {
  title: "Technology Fingerprinting",
  description:
    "Map the servers, frameworks, CDNs and libraries behind every exposed asset.",
};

export default function TechnologyPage() {
  return <ModulePreview module={getModulePreview("technology")} />;
}
