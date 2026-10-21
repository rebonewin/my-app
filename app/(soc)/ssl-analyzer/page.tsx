import type { Metadata } from "next";

import { ModulePreview } from "@/components/dashboard/ModulePreview";
import { getModulePreview } from "@/lib/soc/modules";

export const metadata: Metadata = {
  title: "SSL Analyzer",
  description:
    "Certificate chains, protocol health and renewal windows across every exposed endpoint.",
};

export default function SslAnalyzerPage() {
  return <ModulePreview module={getModulePreview("ssl-analyzer")} />;
}
