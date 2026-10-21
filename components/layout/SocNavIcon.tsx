import {
  FileIcon,
  FingerprintIcon,
  GaugeIcon,
  GlobeIcon,
  LockIcon,
  RadarIcon,
  ScaleIcon,
  ServerIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@/components/ui/icons";
import type { SocIconName } from "@/lib/soc/navigation";

export function SocNavIcon({
  name,
  size = 18,
}: {
  name: SocIconName;
  size?: number;
}) {
  switch (name) {
    case "gauge":
      return <GaugeIcon size={size} />;
    case "radar":
      return <RadarIcon size={size} />;
    case "lock":
      return <LockIcon size={size} />;
    case "fingerprint":
      return <FingerprintIcon size={size} />;
    case "server":
      return <ServerIcon size={size} />;
    case "shieldcheck":
      return <ShieldCheckIcon size={size} />;
    case "globe":
      return <GlobeIcon size={size} />;
    case "scale":
      return <ScaleIcon size={size} />;
    case "file":
      return <FileIcon size={size} />;
    case "sparkles":
      return <SparklesIcon size={size} />;
    case "settings":
      return <SettingsIcon size={size} />;
  }
}
