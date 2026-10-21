import type { Metadata } from "next";

import { ModulePreview } from "@/components/dashboard/ModulePreview";
import { getModulePreview } from "@/lib/soc/modules";

export const metadata: Metadata = {
  title: "Assets",
  description:
    "A living inventory of domains, hosts, cloud resources and certificates by risk.",
};

export default function AssetsPage() {
  return <ModulePreview module={getModulePreview("assets")} />;
}
