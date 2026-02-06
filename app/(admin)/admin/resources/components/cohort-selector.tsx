'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FolderOpen, Globe, Users } from 'lucide-react';
import type { Cohort } from '@/types';

interface CohortSelectorProps {
  cohorts: Cohort[];
  selectedCohortId: string;
  isGlobalMode: boolean;
  selectedCohort: Cohort | undefined;
  onCohortChange: (cohortId: string) => void;
  onGlobalModeToggle: (enabled: boolean) => void;
}

export function CohortSelector({
  cohorts,
  selectedCohortId,
  isGlobalMode,
  selectedCohort,
  onCohortChange,
  onGlobalModeToggle,
}: CohortSelectorProps) {
  return (
    <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          {isGlobalMode ? (
            <>
              <Globe className="w-5 h-5 text-primary" />
              Global Mode Active
            </>
          ) : selectedCohort ? (
            <>
              <Users className="w-5 h-5 text-primary" />
              Currently uploading for: {selectedCohort.name}
            </>
          ) : (
            <>
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              Select a cohort to start
            </>
          )}
        </CardTitle>
        <CardDescription>
          {isGlobalMode
            ? 'Resources will be available to all students across all cohorts'
            : selectedCohort
              ? `All uploads will be tagged to ${selectedCohort.tag}`
              : 'Choose a target cohort or enable Global Mode'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <Select
              value={selectedCohortId}
              onValueChange={onCohortChange}
              disabled={isGlobalMode}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select cohort..." />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {cohort.tag}
                      </Badge>
                      {cohort.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/50 border">
            <Globe className={`w-4 h-4 ${isGlobalMode ? 'text-primary' : 'text-muted-foreground'}`} />
            <Label htmlFor="global-mode" className="cursor-pointer">
              Global Mode
            </Label>
            <Switch
              id="global-mode"
              checked={isGlobalMode}
              onCheckedChange={onGlobalModeToggle}
            />
          </div>
        </div>

        {(isGlobalMode || selectedCohortId) && (
          <div className={`mt-4 px-4 py-3 rounded-lg flex items-center gap-3 ${
            isGlobalMode
              ? 'bg-primary/10 border border-primary/30'
              : 'bg-accent/10 border border-accent/30'
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              isGlobalMode ? 'bg-primary' : 'bg-accent'
            }`} />
            <span className="text-sm font-medium">
              {isGlobalMode
                ? 'Uploads will be visible to ALL students'
                : `Uploads will only be visible to ${selectedCohort?.name} students`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
