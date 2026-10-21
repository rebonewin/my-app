import { SocCard, SocCardBody, SocCardHeader } from "@/components/ui/soc";
import { cn } from "@/lib/utils";

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SocCard className={cn("overflow-hidden", className)}>
      <SocCardHeader
        title={title}
        description={description}
        action={action}
        className="py-3.5"
      />
      <SocCardBody className="p-4 sm:p-5">{children}</SocCardBody>
    </SocCard>
  );
}
