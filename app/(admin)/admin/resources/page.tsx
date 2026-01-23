'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderPlus, Upload, FolderOpen } from 'lucide-react';

export default function AdminResourcesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resource Management</h1>
        <p className="text-muted-foreground">
          Upload and organize course materials
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Resources
            </CardTitle>
            <CardDescription>
              Drag and drop files or click to upload
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">Click to upload</p>
              <p className="text-sm text-muted-foreground">
                PDF, Docs, XLS, MP4 (max 100MB)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderPlus className="w-5 h-5" />
              Create Folder
            </CardTitle>
            <CardDescription>
              Organize resources into folders by cohort or week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full gradient-bg gap-2">
              <FolderPlus className="w-4 h-4" />
              Create New Folder
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Resources</CardTitle>
          <CardDescription>Browse and manage uploaded files</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No resources uploaded yet</p>
            <p className="text-sm">Upload files to get started</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
