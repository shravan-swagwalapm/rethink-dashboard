'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import type { CaseStudy } from '@/types';

interface CaseStudySectionProps {
  expanded: boolean;
  onToggle: () => void;
  caseStudies: CaseStudy[];
  onAdd: () => void;
  onEdit: (caseStudy: CaseStudy) => void;
  onDelete: (caseStudyId: string) => void;
  onToggleVisibility: (caseStudy: CaseStudy) => void;
  onPreviewProblem: (caseStudy: CaseStudy) => void;
  onPreviewSolution: (caseStudy: CaseStudy) => void;
}

export function CaseStudySection({
  expanded,
  onToggle,
  caseStudies,
  onAdd,
  onEdit,
  onDelete,
  onToggleVisibility,
  onPreviewProblem,
  onPreviewSolution,
}: CaseStudySectionProps) {
  return (
    <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50 shadow-sm overflow-hidden">
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-green-50/50 dark:hover:bg-green-950/10 transition-all border-b dark:border-gray-800 group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="transition-transform group-hover:scale-110">
                  {expanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  )}
                </div>
                <div className="w-9 h-9 rounded-lg bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg font-semibold dark:text-white">Case Studies</CardTitle>
                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-0 font-semibold">
                  {caseStudies.length}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all hover:shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-5 pb-5">
            {caseStudies.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-lg border-2 border-dashed dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <div className="w-12 h-12 rounded-full bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                  <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No case studies added yet</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click &quot;Add&quot; to create your first case study</p>
              </div>
            ) : (
              <div className="space-y-3">
                {caseStudies.map((caseStudy) => (
                  <div
                    key={caseStudy.id}
                    className="flex items-start gap-4 p-5 rounded-lg border-2 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-green-500/50 dark:hover:border-green-500/50 transition-all shadow-sm hover:shadow-md"
                  >
                    <div className="w-12 h-12 rounded-lg bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-base dark:text-white">{caseStudy.title}</p>
                        {caseStudy.solution_visible ? (
                          <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-0">
                            <Eye className="w-3 h-3 mr-1" />
                            Solution Visible
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Solution Hidden
                          </Badge>
                        )}
                      </div>
                      {caseStudy.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{caseStudy.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        {caseStudy.problem_file_path && (
                          <button
                            onClick={() => onPreviewProblem(caseStudy)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Problem PDF
                          </button>
                        )}
                        {caseStudy.solutions && caseStudy.solutions.length > 0 && (
                          <button
                            onClick={() => onPreviewSolution(caseStudy)}
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium flex items-center gap-1.5 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            {caseStudy.solutions.length} Solution{caseStudy.solutions.length !== 1 ? 's' : ''}
                          </button>
                        )}
                        {caseStudy.due_date && (
                          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            Due: {format(new Date(caseStudy.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={caseStudy.solution_visible}
                        onCheckedChange={() => onToggleVisibility(caseStudy)}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(caseStudy)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDelete(caseStudy.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
