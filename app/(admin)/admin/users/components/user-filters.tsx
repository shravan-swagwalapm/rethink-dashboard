'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
  X,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Cohort } from '@/types';

interface UserFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  selectedCohorts: string[];
  onSelectedCohortsChange: (value: string[]) => void;
  phoneStatusFilter: 'all' | 'has_phone' | 'no_phone';
  onPhoneStatusFilterChange: (value: 'all' | 'has_phone' | 'no_phone') => void;
  dateRangeFrom: Date | undefined;
  onDateRangeFromChange: (value: Date | undefined) => void;
  dateRangeTo: Date | undefined;
  onDateRangeToChange: (value: Date | undefined) => void;
  multiRoleFilter: 'all' | 'single' | 'multiple';
  onMultiRoleFilterChange: (value: 'all' | 'single' | 'multiple') => void;
  cohorts: Cohort[];
  activeFilterCount: number;
  onClearAll: () => void;
}

export function UserFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  selectedCohorts,
  onSelectedCohortsChange,
  phoneStatusFilter,
  onPhoneStatusFilterChange,
  dateRangeFrom,
  onDateRangeFromChange,
  dateRangeTo,
  onDateRangeToChange,
  multiRoleFilter,
  onMultiRoleFilterChange,
  cohorts,
  activeFilterCount,
  onClearAll,
}: UserFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        {!showFilters && (
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(true)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        )}

        {showFilters && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Advanced Filters</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={roleFilter} onValueChange={onRoleFilterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="company_user">Company User</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="master">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Phone Status</Label>
                <Select value={phoneStatusFilter} onValueChange={(value) => onPhoneStatusFilterChange(value as 'all' | 'has_phone' | 'no_phone')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="has_phone">Has Phone Number</SelectItem>
                    <SelectItem value="no_phone">Missing Phone Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Role Count</Label>
                <Select value={multiRoleFilter} onValueChange={(value) => onMultiRoleFilterChange(value as 'all' | 'single' | 'multiple')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="single">Single Role Only</SelectItem>
                    <SelectItem value="multiple">Multiple Roles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cohorts (Multi-select)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30 max-h-48 overflow-y-auto">
                {cohorts.map((cohort) => (
                  <div key={cohort.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cohort-${cohort.id}`}
                      checked={selectedCohorts.includes(cohort.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onSelectedCohortsChange([...selectedCohorts, cohort.id]);
                        } else {
                          onSelectedCohortsChange(selectedCohorts.filter(id => id !== cohort.id));
                        }
                      }}
                    />
                    <label
                      htmlFor={`cohort-${cohort.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {cohort.name} ({cohort.tag})
                    </label>
                  </div>
                ))}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="cohort-none"
                    checked={selectedCohorts.includes('no_cohort')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSelectedCohortsChange([...selectedCohorts, 'no_cohort']);
                      } else {
                        onSelectedCohortsChange(selectedCohorts.filter(id => id !== 'no_cohort'));
                      }
                    }}
                  />
                  <label htmlFor="cohort-none" className="text-sm cursor-pointer flex-1">
                    No Cohort Assigned
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Registration Date</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !dateRangeFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRangeFrom ? format(dateRangeFrom, "MMM d, yyyy") : "From date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRangeFrom}
                      onSelect={onDateRangeFromChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !dateRangeTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRangeTo ? format(dateRangeTo, "MMM d, yyyy") : "To date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRangeTo}
                      onSelect={onDateRangeToChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={onClearAll}>
                Clear All Filters
              </Button>
              <Button onClick={() => setShowFilters(false)} className="gradient-bg">
                Apply Filters
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActiveFilterChipsProps {
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  selectedCohorts: string[];
  onSelectedCohortsChange: (value: string[]) => void;
  phoneStatusFilter: 'all' | 'has_phone' | 'no_phone';
  onPhoneStatusFilterChange: (value: 'all' | 'has_phone' | 'no_phone') => void;
  dateRangeFrom: Date | undefined;
  onDateRangeFromChange: (value: Date | undefined) => void;
  dateRangeTo: Date | undefined;
  onDateRangeToChange: (value: Date | undefined) => void;
  multiRoleFilter: 'all' | 'single' | 'multiple';
  onMultiRoleFilterChange: (value: 'all' | 'single' | 'multiple') => void;
  cohorts: Cohort[];
  activeFilterCount: number;
  onClearAll: () => void;
}

export function ActiveFilterChips({
  roleFilter,
  onRoleFilterChange,
  selectedCohorts,
  onSelectedCohortsChange,
  phoneStatusFilter,
  onPhoneStatusFilterChange,
  dateRangeFrom,
  onDateRangeFromChange,
  dateRangeTo,
  onDateRangeToChange,
  multiRoleFilter,
  onMultiRoleFilterChange,
  cohorts,
  activeFilterCount,
  onClearAll,
}: ActiveFilterChipsProps) {
  if (activeFilterCount === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-muted-foreground">Active Filters:</span>

      {roleFilter !== 'all' && (
        <Badge variant="secondary" className="gap-1">
          Role: {roleFilter === 'master' ? 'Guest' : roleFilter.replace('_', ' ')}
          <X className="w-3 h-3 cursor-pointer" onClick={() => onRoleFilterChange('all')} />
        </Badge>
      )}

      {selectedCohorts.map(cohortId => (
        <Badge key={cohortId} variant="secondary" className="gap-1">
          {cohortId === 'no_cohort' ? 'No Cohort' : cohorts.find(c => c.id === cohortId)?.name}
          <X className="w-3 h-3 cursor-pointer"
             onClick={() => onSelectedCohortsChange(selectedCohorts.filter(id => id !== cohortId))} />
        </Badge>
      ))}

      {phoneStatusFilter !== 'all' && (
        <Badge variant="secondary" className="gap-1">
          {phoneStatusFilter === 'has_phone' ? 'Has Phone' : 'Missing Phone'}
          <X className="w-3 h-3 cursor-pointer" onClick={() => onPhoneStatusFilterChange('all')} />
        </Badge>
      )}

      {(dateRangeFrom || dateRangeTo) && (
        <Badge variant="secondary" className="gap-1">
          Date: {dateRangeFrom ? format(dateRangeFrom, 'MMM d') : '...'} -
          {dateRangeTo ? format(dateRangeTo, 'MMM d, yyyy') : '...'}
          <X className="w-3 h-3 cursor-pointer"
             onClick={() => { onDateRangeFromChange(undefined); onDateRangeToChange(undefined); }} />
        </Badge>
      )}

      {multiRoleFilter !== 'all' && (
        <Badge variant="secondary" className="gap-1">
          {multiRoleFilter === 'single' ? 'Single Role' : 'Multiple Roles'}
          <X className="w-3 h-3 cursor-pointer" onClick={() => onMultiRoleFilterChange('all')} />
        </Badge>
      )}

      <Button variant="ghost" size="sm" onClick={onClearAll}>
        Clear All
      </Button>
    </div>
  );
}
