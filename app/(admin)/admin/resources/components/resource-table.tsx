'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FolderOpen,
  MoreVertical,
  Trash2,
  Pencil,
  ExternalLink,
  Globe,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Cohort } from '@/types';
import {
  ResourceWithCohort,
  ITEMS_PER_PAGE,
  formatFileSize,
  getCategoryIcon,
  exportToCSV,
} from '../types';

interface ResourceTableProps {
  resources: ResourceWithCohort[];
  resourcesLoading: boolean;
  isGlobalMode: boolean;
  selectedCohort: Cohort | undefined;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  selectedResourceIds: Set<string>;
  onToggleSelectAll: () => void;
  onToggleSelectResource: (id: string) => void;
  onEdit: (resource: ResourceWithCohort) => void;
  onDelete: (resource: ResourceWithCohort) => void;
}

export function ResourceTable({
  resources,
  resourcesLoading,
  isGlobalMode,
  selectedCohort,
  searchQuery,
  onSearchChange,
  currentPage,
  onPageChange,
  selectedResourceIds,
  onToggleSelectAll,
  onToggleSelectResource,
  onEdit,
  onDelete,
}: ResourceTableProps) {
  const filteredResources = resources.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);
  const paginatedResources = filteredResources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const allSelected = paginatedResources.length > 0 &&
    paginatedResources.every(r => selectedResourceIds.has(r.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Resources
            </CardTitle>
            <CardDescription>
              {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''}
              {isGlobalMode ? ' (Global)' : selectedCohort ? ` in ${selectedCohort.name}` : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(filteredResources)}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {resourcesLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-lg">No resources found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? 'Try a different search term'
                : 'Upload some resources to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={onToggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Uploaded</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedResources.map((resource) => (
                    <TableRow
                      key={resource.id}
                      className={`transition-colors ${
                        selectedResourceIds.has(resource.id) ? 'bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedResourceIds.has(resource.id)}
                          onCheckedChange={() => onToggleSelectResource(resource.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {getCategoryIcon(resource.category)}
                          <div>
                            <p className="font-medium truncate max-w-xs">{resource.name}</p>
                            {resource.is_global ? (
                              <Badge variant="outline" className="text-xs mt-1">
                                <Globe className="w-3 h-3 mr-1" />
                                Global
                              </Badge>
                            ) : resource.cohort && (
                              <Badge variant="secondary" className="text-xs mt-1">
                                {resource.cohort.tag}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {resource.category || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">
                        {resource.type === 'link' ? 'External Link' : 'File'}
                      </TableCell>
                      <TableCell>{formatFileSize(resource.file_size)}</TableCell>
                      <TableCell>
                        {format(new Date(resource.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {resource.external_url && (
                              <DropdownMenuItem asChild>
                                <a
                                  href={resource.external_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  Open Link
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => onEdit(resource)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => onDelete(resource)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredResources.length)} of{' '}
                  {filteredResources.length} resources
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
