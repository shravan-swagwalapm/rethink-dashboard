import { Badge } from '@/components/ui/badge';
import type { StudentHealthStatus } from '@/types';

interface HealthBadgeProps {
  status: StudentHealthStatus;
  showDot?: boolean;
}

const statusConfig: Record<StudentHealthStatus, { label: string; dotClass: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', dotClass: 'bg-green-500', badgeVariant: 'default' },
  at_risk: { label: 'At-Risk', dotClass: 'bg-yellow-500', badgeVariant: 'secondary' },
  inactive: { label: 'Inactive', dotClass: 'bg-red-500', badgeVariant: 'destructive' },
};

export function HealthBadge({ status, showDot = true }: HealthBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.badgeVariant} className="gap-1.5">
      {showDot && (
        <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      )}
      {config.label}
    </Badge>
  );
}

export function HealthDot({ status }: { status: StudentHealthStatus }) {
  const config = statusConfig[status];
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${config.dotClass}`} />;
}
