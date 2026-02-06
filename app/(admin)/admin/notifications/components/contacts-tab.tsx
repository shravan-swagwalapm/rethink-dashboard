'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus,
  Mail,
  Phone,
  Edit,
  Trash2,
  Loader2,
  Users,
  Upload,
  UserPlus,
  FolderPlus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { CSVImportDialog } from '@/components/admin/notifications/csv-import-dialog';
import { CohortImportDialog } from '@/components/admin/notifications/cohort-import-dialog';
import { ContactList, Contact } from '../types';

export function ContactsTab() {
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showListForm, setShowListForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCohortImportDialog, setShowCohortImportDialog] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [listFormData, setListFormData] = useState({
    name: '',
    description: '',
    tags: [] as string[],
  });
  const [contactFormData, setContactFormData] = useState({
    email: '',
    phone: '',
    name: '',
  });

  useEffect(() => {
    fetchContactLists();
  }, []);

  const fetchContactLists = async () => {
    try {
      setLoadingContacts(true);
      const response = await fetch('/api/admin/notifications/contacts');
      if (!response.ok) throw new Error('Failed to fetch contact lists');
      const result = await response.json();
      setContactLists(result.data || []);
    } catch (error) {
      console.error('Error fetching contact lists:', error);
      toast.error('Failed to load contact lists');
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchContacts = async (listId: string) => {
    try {
      setLoadingContacts(true);
      const response = await fetch(`/api/admin/notifications/contacts?list_id=${listId}`);
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const result = await response.json();
      setContacts(result.data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const openCreateList = () => {
    setEditingList(null);
    setListFormData({ name: '', description: '', tags: [] });
    setShowListForm(true);
  };

  const openEditList = (list: ContactList) => {
    setEditingList(list);
    setListFormData({
      name: list.name,
      description: list.description || '',
      tags: list.tags || [],
    });
    setShowListForm(true);
  };

  const handleCreateList = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listFormData),
      });

      if (!response.ok) throw new Error('Failed to create list');

      toast.success('Contact list created');
      setShowListForm(false);
      await fetchContactLists();
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error('Failed to create contact list');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateList = async () => {
    if (!editingList) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingList.id,
          type: 'list',
          ...listFormData,
        }),
      });

      if (!response.ok) throw new Error('Failed to update list');

      toast.success('Contact list updated');
      setShowListForm(false);
      await fetchContactLists();
      if (selectedList?.id === editingList.id) {
        setSelectedList({ ...editingList, ...listFormData } as ContactList);
      }
    } catch (error) {
      console.error('Error updating list:', error);
      toast.error('Failed to update contact list');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm('Delete this contact list and all its contacts? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/notifications/contacts?id=${id}&type=list`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete list');

      toast.success('Contact list deleted');
      if (selectedList?.id === id) {
        setSelectedList(null);
        setContacts([]);
      }
      await fetchContactLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      toast.error('Failed to delete contact list');
    }
  };

  const openCreateContact = () => {
    setEditingContact(null);
    setContactFormData({ email: '', phone: '', name: '' });
    setShowContactForm(true);
  };

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactFormData({
      email: contact.email || '',
      phone: contact.phone || '',
      name: contact.name || '',
    });
    setShowContactForm(true);
  };

  const handleCreateContact = async () => {
    if (!selectedList) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: selectedList.id,
          contacts: [contactFormData],
        }),
      });

      if (!response.ok) throw new Error('Failed to create contact');

      toast.success('Contact added');
      setShowContactForm(false);
      await fetchContacts(selectedList.id);
      await fetchContactLists();
    } catch (error) {
      console.error('Error creating contact:', error);
      toast.error('Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact || !selectedList) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingContact.id,
          type: 'contact',
          ...contactFormData,
        }),
      });

      if (!response.ok) throw new Error('Failed to update contact');

      toast.success('Contact updated');
      setShowContactForm(false);
      await fetchContacts(selectedList.id);
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Delete this contact? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/notifications/contacts?id=${id}&type=contact`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete contact');

      toast.success('Contact deleted');
      if (selectedList) {
        await fetchContacts(selectedList.id);
        await fetchContactLists();
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  const handleImportComplete = async () => {
    if (selectedList) {
      await fetchContacts(selectedList.id);
      await fetchContactLists();
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold">Contact Lists</h2>
            <p className="text-sm text-muted-foreground">
              Manage guest contacts and mailing lists
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={openCreateList}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Create List
            </Button>
          </div>
        </div>

        {loadingContacts && !contactLists.length ? (
          <Card>
            <CardContent className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
              <p className="text-sm text-muted-foreground">Loading contact lists...</p>
            </CardContent>
          </Card>
        ) : contactLists.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">No contact lists yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first contact list to start managing guest contacts
              </p>
              <Button onClick={openCreateList}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Create First List
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Contact Lists (Left Side) */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Lists ({contactLists.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contactLists.map((list) => (
                    <div
                      key={list.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedList?.id === list.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        setSelectedList(list);
                        fetchContacts(list.id);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">{list.name}</h4>
                        <Badge variant="secondary">
                          {list.contact_count}
                        </Badge>
                      </div>
                      {list.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {list.description}
                        </p>
                      )}
                      {list.tags && list.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {list.tags.map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditList(list);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Contacts (Right Side) */}
            <div className="lg:col-span-2">
              {selectedList ? (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>{selectedList.name}</CardTitle>
                        <CardDescription>
                          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowImportDialog(true)}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Import CSV
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowCohortImportDialog(true)}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Import from Cohort
                        </Button>
                        <Button size="sm" onClick={openCreateContact}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add Contact
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingContacts ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                        <p className="text-sm text-muted-foreground">Loading contacts...</p>
                      </div>
                    ) : contacts.length === 0 ? (
                      <div className="text-center py-8">
                        <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-sm text-muted-foreground mb-4">
                          No contacts in this list yet
                        </p>
                        <div className="flex gap-2 justify-center flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowImportDialog(true)}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Import CSV
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCohortImportDialog(true)}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            Import from Cohort
                          </Button>
                          <Button size="sm" onClick={openCreateContact}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Contact
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted"
                          >
                            <div>
                              <p className="font-medium">{contact.name || 'No name'}</p>
                              <div className="flex gap-4 text-sm text-muted-foreground">
                                {contact.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {contact.email}
                                  </span>
                                )}
                                {contact.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </span>
                                )}
                              </div>
                              {contact.unsubscribed && (
                                <Badge variant="destructive" className="mt-1">
                                  Unsubscribed
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEditContact(contact)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteContact(contact.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-16">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a contact list</p>
                    <p className="text-sm text-muted-foreground">
                      Choose a list from the left to view and manage contacts
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contact List Form Dialog */}
      <Dialog open={showListForm} onOpenChange={setShowListForm}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[550px]">
          <DialogHeader className="pb-4 border-b dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                editingList
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                  : 'bg-gradient-to-br from-green-500 to-teal-600'
              }`}>
                <FolderPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="dark:text-white text-xl">
                  {editingList ? 'Edit Contact List' : 'Create Contact List'}
                </DialogTitle>
                <DialogDescription className="dark:text-gray-400 text-sm mt-1">
                  {editingList
                    ? 'Update the contact list details below'
                    : 'Organize your external contacts into groups for easy targeting'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-5">
            {/* List Name */}
            <div className="space-y-2">
              <Label htmlFor="list-name" className="dark:text-gray-300 font-medium flex items-center gap-2">
                List Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="list-name"
                value={listFormData.name}
                onChange={(e) =>
                  setListFormData({ ...listFormData, name: e.target.value })
                }
                placeholder="e.g., Newsletter Subscribers, Event Attendees"
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="list-description" className="dark:text-gray-300 font-medium">
                  Description <span className="text-gray-400 text-xs">(Optional)</span>
                </Label>
                <span className="text-xs text-gray-500">
                  {listFormData.description.length}/200
                </span>
              </div>
              <Textarea
                id="list-description"
                value={listFormData.description}
                onChange={(e) =>
                  setListFormData({ ...listFormData, description: e.target.value.slice(0, 200) })
                }
                placeholder="Describe who's in this list and how you'll use it..."
                rows={3}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white resize-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="list-tags" className="dark:text-gray-300 font-medium">
                Tags <span className="text-gray-400 text-xs">(Optional)</span>
              </Label>
              <Input
                id="list-tags"
                value={listFormData.tags.join(', ')}
                onChange={(e) =>
                  setListFormData({
                    ...listFormData,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
                placeholder="marketing, newsletter, leads"
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Separate tags with commas to categorize this list
              </p>
            </div>

            {/* Tags Preview */}
            {listFormData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {listFormData.tags.map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={() => {
                      setListFormData({
                        ...listFormData,
                        tags: listFormData.tags.filter((_, i) => i !== idx),
                      });
                    }}
                  >
                    {tag}
                    <span className="ml-1 text-gray-400">&times;</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t dark:border-gray-800">
            <Button variant="outline" onClick={() => setShowListForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingList ? handleUpdateList : handleCreateList}
              disabled={!listFormData.name.trim() || saving}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingList ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Update List
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create List
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Form Dialog */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[500px]">
          <DialogHeader className="pb-4 border-b dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                editingContact
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                  : 'bg-gradient-to-br from-blue-500 to-indigo-600'
              }`}>
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="dark:text-white text-xl">
                  {editingContact ? 'Edit Contact' : 'Add New Contact'}
                </DialogTitle>
                <DialogDescription className="dark:text-gray-400 text-sm mt-1">
                  {editingContact
                    ? 'Update the contact information below'
                    : `Adding to ${selectedList?.name || 'this list'}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-5">
            {/* Contact Name */}
            <div className="space-y-2">
              <Label htmlFor="contact-name" className="dark:text-gray-300 font-medium flex items-center gap-2">
                Full Name
              </Label>
              <Input
                id="contact-name"
                value={contactFormData.name}
                onChange={(e) =>
                  setContactFormData({ ...contactFormData, name: e.target.value })
                }
                placeholder="John Doe"
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="contact-email" className="dark:text-gray-300 font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                Email Address
                {!contactFormData.phone && <span className="text-red-500 text-xs ml-1">*</span>}
              </Label>
              <Input
                id="contact-email"
                type="email"
                value={contactFormData.email}
                onChange={(e) =>
                  setContactFormData({ ...contactFormData, email: e.target.value })
                }
                placeholder="john@example.com"
                className={`dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 focus:ring-2 focus:ring-blue-500 ${
                  contactFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactFormData.email)
                    ? 'border-red-500 focus:ring-red-500'
                    : ''
                }`}
              />
              {contactFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactFormData.email) && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Please enter a valid email address
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="contact-phone" className="dark:text-gray-300 font-medium flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                Phone Number
                {!contactFormData.email && <span className="text-red-500 text-xs ml-1">*</span>}
              </Label>
              <Input
                id="contact-phone"
                type="tel"
                value={contactFormData.phone}
                onChange={(e) =>
                  setContactFormData({ ...contactFormData, phone: e.target.value })
                }
                placeholder="+91 98765 43210"
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Include country code for SMS/WhatsApp notifications
              </p>
            </div>

            {/* Validation Notice */}
            <div className={`p-3 rounded-lg flex items-start gap-2 ${
              !contactFormData.email && !contactFormData.phone
                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            }`}>
              {!contactFormData.email && !contactFormData.phone ? (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Please provide at least an email or phone number to send notifications
                  </p>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-green-800 dark:text-green-200">
                    Contact can receive {contactFormData.email ? 'email' : ''}
                    {contactFormData.email && contactFormData.phone ? ' and ' : ''}
                    {contactFormData.phone ? 'SMS/WhatsApp' : ''} notifications
                  </p>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="pt-4 border-t dark:border-gray-800">
            <Button variant="outline" onClick={() => setShowContactForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingContact ? handleUpdateContact : handleCreateContact}
              disabled={
                (!contactFormData.email && !contactFormData.phone) ||
                (contactFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactFormData.email)) ||
                saving
              }
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingContact ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Update Contact
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Contact
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      {selectedList && (
        <CSVImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          listId={selectedList.id}
          onImportComplete={handleImportComplete}
        />
      )}

      {/* Cohort Import Dialog */}
      {selectedList && (
        <CohortImportDialog
          open={showCohortImportDialog}
          onOpenChange={setShowCohortImportDialog}
          contactListId={selectedList.id}
          contactListName={selectedList.name}
          onImportComplete={handleImportComplete}
        />
      )}
    </>
  );
}
