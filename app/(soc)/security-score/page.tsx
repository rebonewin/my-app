import type { Metadata } from "next";

import { ModulePreview } from "@/components/dashboard/ModulePreview";
import { getModulePreview } from "@/lib/soc/modules";

export const metadata: Metadata = {
  title: "Security Score",
  description:
    "A transparent, evidence-backed view of security posture and control coverage.",
};

export default function SecurityScorePage() {
  return <ModulePreview module={getModulePreview("security-score")} />;
}
