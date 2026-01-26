'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface Variable {
  name: string;
  example: string;
}

interface VariableEditorProps {
  variables: Variable[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

export function VariableEditor({ variables, values, onChange }: VariableEditorProps) {
  const handleChange = (variableName: string, value: string) => {
    onChange({
      ...values,
      [variableName]: value,
    });
  };

  if (!variables || variables.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        This template has no variables to customize
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">Template Variables</h4>
        <Badge variant="secondary">{variables.length} variable{variables.length !== 1 ? 's' : ''}</Badge>
      </div>

      <div className="space-y-3">
        {variables.map((variable) => (
          <div key={variable.name} className="space-y-2">
            <Label htmlFor={`var-${variable.name}`} className="flex items-center gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                {`{{${variable.name}}}`}
              </span>
              <span className="text-xs text-muted-foreground">
                Example: {variable.example}
              </span>
            </Label>
            <Input
              id={`var-${variable.name}`}
              value={values[variable.name] || ''}
              onChange={(e) => handleChange(variable.name, e.target.value)}
              placeholder={variable.example}
              className="font-medium"
            />
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded-lg">
        <strong>Note:</strong> These values will replace the variables in your template.
        Leave empty to use the example values.
      </div>
    </div>
  );
}
