import {
  AlertIcon,
  BugIcon,
  CertificateIcon,
  RadarIcon,
  ScaleIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import type { WidgetIconName } from "@/types/dashboard";

export function WidgetIcon({
  name,
  size = 16,
}: {
  name: WidgetIconName;
  size?: number;
}) {
  switch (name) {
    case "shield":
      return <ShieldCheckIcon size={size} />;
    case "server":
      return <ServerIcon size={size} />;
    case "radar":
      return <RadarIcon size={size} />;
    case "alert":
      return <AlertIcon size={size} />;
    case "certificate":
      return <CertificateIcon size={size} />;
    case "bug":
      return <BugIcon size={size} />;
    case "scale":
      return <ScaleIcon size={size} />;
    case "sparkles":
      return <SparklesIcon size={size} />;
  }
}
