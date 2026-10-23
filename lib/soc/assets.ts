import type { SocBadgeTone } from "@/components/ui/soc";
import type {
  AssetCriticality,
  AssetEnvironment,
  AssetRiskLevel,
  AssetStatus,
  AssetType,
} from "@/types/assets";
import { titleCase } from "@/lib/utils";

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  website: "Website",
  api: "API",
  "web-application": "Web application",
  "internal-service": "Internal service",
  "external-service": "External service",
};

export const ASSET_ENVIRONMENT_LABELS: Record<AssetEnvironment, string> = {
  production: "Production",
  staging: "Staging",
  development: "Development",
};

export const ASSET_CRITICALITY_META: Record<
  AssetCriticality,
  { label: string; tone: SocBadgeTone; weight: number }
> = {
  critical: { label: "Critical", tone: "critical", weight: 4 },
  high: { label: "High", tone: "high", weight: 3 },
  medium: { label: "Medium", tone: "medium", weight: 2 },
  low: { label: "Low", tone: "low", weight: 1 },
};

export const ASSET_STATUS_META: Record<
  AssetStatus,
  { label: string; tone: SocBadgeTone }
> = {
  active: { label: "Active", tone: "success" },
  disabled: { label: "Disabled", tone: "neutral" },
};

export const ASSET_RISK_META: Record<
  AssetRiskLevel,
  { label: string; tone: SocBadgeTone }
> = {
  critical: { label: "Critical", tone: "critical" },
  high: { label: "High", tone: "high" },
  medium: { label: "Medium", tone: "medium" },
  low: { label: "Low", tone: "low" },
  none: { label: "Clear", tone: "success" },
  unknown: { label: "Unscanned", tone: "neutral" },
};

export function assetTypeLabel(value: string): string {
  return ASSET_TYPE_LABELS[value as AssetType] ?? titleCase(value);
}

export function assetEnvironmentLabel(value: string): string {
  return ASSET_ENVIRONMENT_LABELS[value as AssetEnvironment] ?? titleCase(value);
}

export function criticalityMeta(value: string) {
  return (
    ASSET_CRITICALITY_META[value as AssetCriticality] ??
    ASSET_CRITICALITY_META.medium
  );
}

export function riskMeta(value: string) {
  return ASSET_RISK_META[value as AssetRiskLevel] ?? ASSET_RISK_META.unknown;
}
