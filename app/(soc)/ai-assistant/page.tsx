import type { Metadata } from "next";

import { ModulePreview } from "@/components/dashboard/ModulePreview";
import { getModulePreview } from "@/lib/soc/modules";

export const metadata: Metadata = {
  title: "AI Security Assistant",
  description:
    "Ask grounded questions about posture, findings and audit evidence.",
};

export default function AiAssistantPage() {
  return <ModulePreview module={getModulePreview("ai-assistant")} />;
}
