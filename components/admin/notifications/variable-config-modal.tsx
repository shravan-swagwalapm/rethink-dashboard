'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Zap,
  Database,
  User,
  Users,
  Calendar,
  Link2,
  Mail,
  Phone,
  Plus,
  Copy,
  Check,
  Trash2,
  Info,
  Settings,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// System variables with data sources
const SYSTEM_VARIABLES = [
  {
    name: 'name',
    label: 'Recipient Name',
    description: 'Full name of the recipient',
    source: 'profiles.full_name',
    sourceLabel: 'User Profile',
    icon: User,
    category: 'user',
    example: 'John Doe',
  },
  {
    name: 'email',
    label: 'Email Address',
    description: 'Email address of the recipient',
    source: 'profiles.email',
    sourceLabel: 'User Profile',
    icon: Mail,
    category: 'user',
    example: 'john@example.com',
  },
  {
    name: 'phone',
    label: 'Phone Number',
    description: 'Phone number of the recipient',
    source: 'profiles.phone',
    sourceLabel: 'User Profile',
    icon: Phone,
    category: 'user',
    example: '+919876543210',
  },
  {
    name: 'cohort_name',
    label: 'Cohort Name',
    description: 'Name of the cohort the user belongs to',
    source: 'cohorts.name',
    sourceLabel: 'Cohort',
    icon: Users,
    category: 'cohort',
    example: 'Batch 2025',
  },
  {
    name: 'cohort_tag',
    label: 'Cohort Tag',
    description: 'Short identifier tag for the cohort',
    source: 'cohorts.tag',
    sourceLabel: 'Cohort',
    icon: Users,
    category: 'cohort',
    example: 'B2025',
  },
  {
    name: 'start_date',
    label: 'Start Date',
    description: 'Cohort start date',
    source: 'cohorts.start_date',
    sourceLabel: 'Cohort',
    icon: Calendar,
    category: 'cohort',
    example: 'January 15, 2025',
  },
  {
    name: 'end_date',
    label: 'End Date',
    description: 'Cohort end date',
    source: 'cohorts.end_date',
    sourceLabel: 'Cohort',
    icon: Calendar,
    category: 'cohort',
    example: 'March 15, 2025',
  },
];

// Custom variable placeholders
const CUSTOM_VARIABLE_EXAMPLES = [
  { name: 'link', label: 'Custom Link', example: 'https://example.com/resource' },
  { name: 'discount_code', label: 'Discount Code', example: 'SAVE20' },
  { name: 'event_name', label: 'Event Name', example: 'Product Launch' },
  { name: 'meeting_time', label: 'Meeting Time', example: '3:00 PM IST' },
];

interface VariableConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertVariable: (variable: string) => void;
  customVariables?: Array<{ name: string; example: string }>;
  onCustomVariablesChange?: (variables: Array<{ name: string; example: string }>) => void;
}

interface TestUser {
  id: string;
  full_name: string;
  email: string;
}

interface TestCohort {
  id: string;
  name: string;
}

interface TestResult {
  name: string;
  email: string;
  phone: string;
  cohort_name: string;
  cohort_tag: string;
  start_date: string;
  end_date: string;
}

export function VariableConfigModal({
  open,
  onOpenChange,
  onInsertVariable,
  customVariables = [],
  onCustomVariablesChange,
}: VariableConfigModalProps) {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState('');
  const [newVarExample, setNewVarExample] = useState('');

  // Test variables state
  const [testUsers, setTestUsers] = useState<TestUser[]>([]);
  const [testCohorts, setTestCohorts] = useState<TestCohort[]>([]);
  const [selectedTestUser, setSelectedTestUser] = useState<string>('');
  const [selectedTestCohort, setSelectedTestCohort] = useState<string>('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Fetch test users and cohorts when modal opens
  useEffect(() => {
    if (open) {
      fetchTestOptions();
    }
  }, [open]);

  const fetchTestOptions = async () => {
    setLoadingOptions(true);
    try {
      const response = await fetch('/api/admin/notifications/test-variables');
      if (response.ok) {
        const data = await response.json();
        setTestUsers(data.users || []);
        setTestCohorts(data.cohorts || []);
      }
    } catch (error) {
      console.error('Error fetching test options:', error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const runTest = async () => {
    if (!selectedTestUser && !selectedTestCohort) {
      toast.error('Please select a user or cohort to test');
      return;
    }

    setTestLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTestUser) params.set('user_id', selectedTestUser);
      if (selectedTestCohort) params.set('cohort_id', selectedTestCohort);

      const response = await fetch(`/api/admin/notifications/test-variables?${params}`);
      if (!response.ok) throw new Error('Failed to fetch test data');

      const data = await response.json();
      setTestResult(data.result);
      toast.success('Variable data fetched successfully');
    } catch (error) {
      console.error('Error testing variables:', error);
      toast.error('Failed to fetch test data');
    } finally {
      setTestLoading(false);
    }
  };

  const copyVariable = (varName: string) => {
    const varText = `{{${varName}}}`;
    navigator.clipboard.writeText(varText);
    setCopiedVar(varName);
    toast.success(`Copied ${varText} to clipboard`);
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const insertVariable = (varName: string) => {
    onInsertVariable(`{{${varName}}}`);
    toast.success(`Inserted {{${varName}}}`);
  };

  const addCustomVariable = () => {
    if (!newVarName.trim()) {
      toast.error('Variable name is required');
      return;
    }

    const cleanName = newVarName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Check if already exists
    const allVars = [...SYSTEM_VARIABLES.map(v => v.name), ...customVariables.map(v => v.name)];
    if (allVars.includes(cleanName)) {
      toast.error('Variable already exists');
      return;
    }

    const newVar = {
      name: cleanName,
      example: newVarExample || `[${cleanName}]`,
    };

    onCustomVariablesChange?.([...customVariables, newVar]);
    setNewVarName('');
    setNewVarExample('');
    toast.success(`Added custom variable {{${cleanName}}}`);
  };

  const removeCustomVariable = (name: string) => {
    onCustomVariablesChange?.(customVariables.filter(v => v.name !== name));
    toast.success(`Removed variable {{${name}}}`);
  };

  const categoryLabels: Record<string, string> = {
    user: 'User Data',
    cohort: 'Cohort Data',
  };

  const categoryIcons: Record<string, typeof User> = {
    user: User,
    cohort: Users,
  };

  const groupedVariables = SYSTEM_VARIABLES.reduce((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {} as Record<string, typeof SYSTEM_VARIABLES>);

  const getTestValue = (varName: string): string | null => {
    if (!testResult) return null;
    return (testResult as any)[varName] || null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[750px] max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="dark:text-white text-lg">
                Template Variables
              </DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Configure variables and test with real data from your database
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Test Variables Section */}
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-800 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <h4 className="font-semibold text-sm text-green-900 dark:text-green-100">
                    Test Variables with Real Data
                  </h4>
                </div>
                {testResult && (
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Data loaded
                  </Badge>
                )}
              </div>

              <p className="text-xs text-green-800 dark:text-green-200">
                Select a user and/or cohort to see how variables will resolve with actual database values.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-green-700 dark:text-green-300">Test User</Label>
                  <Select value={selectedTestUser} onValueChange={setSelectedTestUser}>
                    <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-green-300 dark:border-green-700">
                      <SelectValue placeholder={loadingOptions ? "Loading..." : "Select a user"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No user selected</SelectItem>
                      {testUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-green-700 dark:text-green-300">Test Cohort</Label>
                  <Select value={selectedTestCohort} onValueChange={setSelectedTestCohort}>
                    <SelectTrigger className="h-9 text-sm bg-white dark:bg-gray-800 border-green-300 dark:border-green-700">
                      <SelectValue placeholder={loadingOptions ? "Loading..." : "Select a cohort"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No cohort selected</SelectItem>
                      {testCohorts.map((cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>
                          {cohort.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={runTest}
                  disabled={testLoading || (!selectedTestUser && !selectedTestCohort) || (selectedTestUser === 'none' && selectedTestCohort === 'none')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white h-9"
                  size="sm"
                >
                  {testLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Test Variables
                </Button>
                {testResult && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 border-green-300 dark:border-green-700"
                    onClick={() => setTestResult(null)}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Test Results Preview */}
              {testResult && (
                <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-green-700 dark:text-green-300 mb-2">
                    <Database className="w-3 h-3" />
                    Live Data Preview
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {SYSTEM_VARIABLES.map((variable) => {
                      const value = getTestValue(variable.name);
                      const hasValue = value && value !== '-';
                      return (
                        <div key={variable.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900/50 rounded">
                          <code className="text-purple-600 dark:text-purple-400 font-mono">{`{{${variable.name}}}`}</code>
                          <span className={`text-right truncate max-w-[120px] ${hasValue ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                            {value || '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* System Variables */}
            {Object.entries(groupedVariables).map(([category, variables]) => {
              const CategoryIcon = categoryIcons[category];
              return (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CategoryIcon className="w-4 h-4 text-muted-foreground" />
                    <h4 className="font-medium text-sm dark:text-white">
                      {categoryLabels[category]}
                    </h4>
                    <Badge variant="secondary" className="text-xs">
                      {variables.length} variables
                    </Badge>
                  </div>

                  <div className="grid gap-2">
                    {variables.map((variable) => {
                      const Icon = variable.icon;
                      const testValue = getTestValue(variable.name);
                      return (
                        <div
                          key={variable.name}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="p-1.5 rounded-md bg-purple-100 dark:bg-purple-900/30">
                              <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-sm font-mono font-semibold text-purple-700 dark:text-purple-300">
                                  {`{{${variable.name}}}`}
                                </code>
                                <span className="text-sm text-gray-600 dark:text-gray-300">
                                  {variable.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Database className="w-3 h-3" />
                                <span className="font-mono">{variable.source}</span>
                                <span className="text-gray-400">•</span>
                                {testValue && testValue !== '-' ? (
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    "{testValue}"
                                  </span>
                                ) : (
                                  <span>e.g., "{variable.example}"</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => copyVariable(variable.name)}
                                  >
                                    {copiedVar === variable.name ? (
                                      <Check className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy to clipboard</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => insertVariable(variable.name)}
                            >
                              Insert
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <Separator />

            {/* Custom Variables Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-sm dark:text-white">
                  Custom Variables
                </h4>
                <Badge variant="outline" className="text-xs">
                  Set when sending
                </Badge>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Custom variables are values you provide when sending the notification.
                    They're useful for dynamic content like links, promo codes, or event-specific details.
                  </p>
                </div>
              </div>

              {/* Existing Custom Variables */}
              {customVariables.length > 0 && (
                <div className="grid gap-2">
                  {customVariables.map((variable) => (
                    <div
                      key={variable.name}
                      className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/50">
                          <Link2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <code className="text-sm font-mono font-semibold text-blue-700 dark:text-blue-300">
                            {`{{${variable.name}}}`}
                          </code>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Example: {variable.example}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => copyVariable(variable.name)}
                        >
                          {copiedVar === variable.name ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => insertVariable(variable.name)}
                        >
                          Insert
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => removeCustomVariable(variable.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Custom Variable */}
              <div className="p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg space-y-3">
                <Label className="text-sm font-medium dark:text-gray-300">
                  Add Custom Variable
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Variable Name</Label>
                    <Input
                      placeholder="e.g., discount_code"
                      value={newVarName}
                      onChange={(e) => setNewVarName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Example Value</Label>
                    <Input
                      placeholder="e.g., SAVE20"
                      value={newVarExample}
                      onChange={(e) => setNewVarExample(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addCustomVariable}
                  disabled={!newVarName.trim()}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Variable
                </Button>
              </div>

              {/* Quick Add Suggestions */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick Add Suggestions</Label>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_VARIABLE_EXAMPLES.filter(
                    (v) => !customVariables.some((cv) => cv.name === v.name)
                  ).map((suggestion) => (
                    <Button
                      key={suggestion.name}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        onCustomVariablesChange?.([...customVariables, { name: suggestion.name, example: suggestion.example }]);
                        toast.success(`Added {{${suggestion.name}}}`);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {suggestion.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
