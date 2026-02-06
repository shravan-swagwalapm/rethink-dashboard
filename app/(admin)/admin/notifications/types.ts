import { ReactNode } from 'react';
import { Mail, MessageSquare, Phone, Bell } from 'lucide-react';
import { createElement } from 'react';

export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  body: string;
  variables: Array<{ name: string; example: string }>;
  channel: 'email' | 'sms' | 'whatsapp';
  is_active: boolean;
  created_at: string;
}

export interface ContactList {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  contact_count: number;
  created_at: string;
}

export interface Contact {
  id: string;
  list_id: string;
  email?: string;
  phone?: string;
  name?: string;
  metadata: Record<string, any>;
  unsubscribed: boolean;
  created_at: string;
}

export function getChannelIcon(channel: string): ReactNode {
  switch (channel) {
    case 'email':
      return createElement(Mail, { className: 'w-4 h-4' });
    case 'sms':
      return createElement(MessageSquare, { className: 'w-4 h-4' });
    case 'whatsapp':
      return createElement(Phone, { className: 'w-4 h-4' });
    default:
      return createElement(Bell, { className: 'w-4 h-4' });
  }
}

export function getChannelColor(channel: string): string {
  switch (channel) {
    case 'email':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'sms':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'whatsapp':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
  }
}
