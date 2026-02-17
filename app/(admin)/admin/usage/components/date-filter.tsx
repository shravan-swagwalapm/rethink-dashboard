'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';
import type { UsagePeriod } from '@/types';

interface DateFilterProps {
  period: UsagePeriod;
  onPeriodChange: (period: UsagePeriod) => void;
}

export function DateFilter({ period, onPeriodChange }: DateFilterProps) {
  return (
    <Select value={period} onValueChange={(v) => onPeriodChange(v as UsagePeriod)}>
      <SelectTrigger className="w-[160px] gap-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">Today</SelectItem>
        <SelectItem value="week">This Week</SelectItem>
        <SelectItem value="month">This Month</SelectItem>
      </SelectContent>
    </Select>
  );
}
