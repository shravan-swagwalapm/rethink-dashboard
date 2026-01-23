'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Link as LinkIcon,
  Clock,
  Download,
  FileText,
  Save,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Invoice } from '@/types';

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export default function ProfilePage() {
  const { profile, refreshProfile, loading: userLoading } = useUser();
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    timezone: 'Asia/Kolkata',
    linkedin_url: '',
    portfolio_url: '',
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [saving, setSaving] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        timezone: profile.timezone || 'Asia/Kolkata',
        linkedin_url: profile.linkedin_url || '',
        portfolio_url: profile.portfolio_url || '',
      });
    }
  }, [profile]);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!profile?.id) return;

      const supabase = getClient();
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (!error) {
        setInvoices(data || []);
      }
      setInvoicesLoading(false);
    };

    if (profile) {
      fetchInvoices();
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    const supabase = getClient();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          timezone: formData.timezone,
          linkedin_url: formData.linkedin_url,
          portfolio_url: formData.portfolio_url,
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    if (!invoice.pdf_path) {
      toast.error('Invoice PDF not available');
      return;
    }

    const supabase = getClient();
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(invoice.pdf_path, 60);

    if (error || !data) {
      toast.error('Failed to download invoice');
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'pending':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      case 'overdue':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (userLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20 border-4 border-background shadow-lg">
              <AvatarImage src={profile?.avatar_url || ''} />
              <AvatarFallback className="gradient-bg text-white text-2xl font-medium">
                {profile?.full_name?.charAt(0) || profile?.email?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{profile?.full_name || 'User'}</CardTitle>
              <CardDescription>{profile?.email}</CardDescription>
              <Badge variant="secondary" className="mt-2 capitalize">
                {profile?.role}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6 space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="full_name" className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Full Name
            </Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Enter your full name"
            />
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </Label>
            <Input
              value={profile?.email || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact support if needed.
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Phone Number
            </Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+91 98765 43210"
            />
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Timezone
            </Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* LinkedIn */}
          <div className="space-y-2">
            <Label htmlFor="linkedin" className="flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-muted-foreground" />
              LinkedIn Profile
            </Label>
            <Input
              id="linkedin"
              value={formData.linkedin_url}
              onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
              placeholder="https://linkedin.com/in/yourprofile"
            />
          </div>

          {/* Portfolio */}
          <div className="space-y-2">
            <Label htmlFor="portfolio" className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-muted-foreground" />
              Portfolio / Website
            </Label>
            <Input
              id="portfolio"
              value={formData.portfolio_url}
              onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto gradient-bg hover:opacity-90"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Invoices Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoices
          </CardTitle>
          <CardDescription>
            Download your payment invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No invoices available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>₹{invoice.amount?.toLocaleString()}</span>
                        <span>•</span>
                        <span>
                          {invoice.created_at && format(new Date(invoice.created_at), 'MMM d, yyyy')}
                        </span>
                        {invoice.payment_type === 'emi' && (
                          <>
                            <span>•</span>
                            <span>EMI {invoice.emi_number}/{invoice.total_emis}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getPaymentStatusColor(invoice.status)}>
                      {invoice.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownloadInvoice(invoice)}
                      disabled={!invoice.pdf_path}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
