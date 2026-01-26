'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Users, Mail, List, User } from 'lucide-react';
import { toast } from 'sonner';

interface Cohort {
  id: string;
  name: string;
  _count?: { students: number };
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

interface ContactList {
  id: string;
  name: string;
  contact_count: number;
}

interface RecipientSelectorProps {
  selectedCohorts: string[];
  selectedUsers: string[];
  selectedContactLists: string[];
  manualEmails: string;
  onCohortsChange: (cohorts: string[]) => void;
  onUsersChange: (users: string[]) => void;
  onContactListsChange: (lists: string[]) => void;
  onManualEmailsChange: (emails: string) => void;
}

export function RecipientSelector({
  selectedCohorts,
  selectedUsers,
  selectedContactLists,
  manualEmails,
  onCohortsChange,
  onUsersChange,
  onContactListsChange,
  onManualEmailsChange,
}: RecipientSelectorProps) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCohorts();
    fetchContactLists();
  }, []);

  const fetchCohorts = async () => {
    try {
      const response = await fetch('/api/admin/cohorts');
      if (!response.ok) throw new Error('Failed to fetch cohorts');
      const result = await response.json();
      setCohorts(result.data || []);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
      toast.error('Failed to load cohorts');
    }
  };

  const fetchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      const result = await response.json();
      setUsers(result.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to search users');
    } finally {
      setLoading(false);
    }
  };

  const fetchContactLists = async () => {
    try {
      const response = await fetch('/api/admin/notifications/contacts');
      if (!response.ok) throw new Error('Failed to fetch contact lists');
      const result = await response.json();
      setContactLists(result.data || []);
    } catch (error) {
      console.error('Error fetching contact lists:', error);
      toast.error('Failed to load contact lists');
    }
  };

  const handleCohortToggle = (cohortId: string) => {
    if (selectedCohorts.includes(cohortId)) {
      onCohortsChange(selectedCohorts.filter((id) => id !== cohortId));
    } else {
      onCohortsChange([...selectedCohorts, cohortId]);
    }
  };

  const handleUserToggle = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      onUsersChange(selectedUsers.filter((id) => id !== userId));
    } else {
      onUsersChange([...selectedUsers, userId]);
    }
  };

  const handleContactListToggle = (listId: string) => {
    if (selectedContactLists.includes(listId)) {
      onContactListsChange(selectedContactLists.filter((id) => id !== listId));
    } else {
      onContactListsChange([...selectedContactLists, listId]);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(debounce);
  }, [searchQuery]);

  return (
    <Tabs defaultValue="cohorts" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="cohorts" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Cohorts
          {selectedCohorts.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedCohorts.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="users" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Users
          {selectedUsers.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedUsers.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="lists" className="flex items-center gap-2">
          <List className="h-4 w-4" />
          Lists
          {selectedContactLists.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {selectedContactLists.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="manual" className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Manual
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cohorts" className="space-y-2 mt-4">
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No cohorts available
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {cohorts.map((cohort) => (
              <div
                key={cohort.id}
                className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => handleCohortToggle(cohort.id)}
              >
                <Checkbox
                  checked={selectedCohorts.includes(cohort.id)}
                  onCheckedChange={() => handleCohortToggle(cohort.id)}
                />
                <div className="flex-1">
                  <p className="font-medium">{cohort.name}</p>
                  {cohort._count?.students !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      {cohort._count.students} student{cohort._count.students !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="users" className="space-y-2 mt-4">
        <Input
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-2"
        />
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Searching...
          </p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchQuery ? 'No users found' : 'Start typing to search users'}
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => handleUserToggle(user.id)}
              >
                <Checkbox
                  checked={selectedUsers.includes(user.id)}
                  onCheckedChange={() => handleUserToggle(user.id)}
                />
                <div className="flex-1">
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="lists" className="space-y-2 mt-4">
        {contactLists.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No contact lists available
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {contactLists.map((list) => (
              <div
                key={list.id}
                className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                onClick={() => handleContactListToggle(list.id)}
              >
                <Checkbox
                  checked={selectedContactLists.includes(list.id)}
                  onCheckedChange={() => handleContactListToggle(list.id)}
                />
                <div className="flex-1">
                  <p className="font-medium">{list.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {list.contact_count} contact{list.contact_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="manual" className="mt-4">
        <div className="space-y-2">
          <Label htmlFor="manual-emails">Email Addresses (one per line)</Label>
          <Textarea
            id="manual-emails"
            value={manualEmails}
            onChange={(e) => onManualEmailsChange(e.target.value)}
            placeholder="john@example.com&#10;jane@example.com&#10;bob@example.com"
            rows={8}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Enter email addresses, one per line
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
