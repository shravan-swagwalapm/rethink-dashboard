'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
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
  Upload,
  Share2,
  QrCode,
  Copy,
  Check,
  Eye,
  RefreshCw,
  Link2,
  ExternalLink,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Invoice } from '@/types';
import { generateQRCode, downloadQRCode } from '@/lib/qr-code';
import { ProfileCardPreviewModal } from '@/components/ProfileCardPreviewModal';

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

interface ProfileCard {
  id: string;
  user_id: string;
  slug: string;
  is_active: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

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

  // Profile image upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Shareable profile card state
  const [profileCard, setProfileCard] = useState<ProfileCard | null>(null);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  // Fetch profile card on mount
  useEffect(() => {
    if (profile) {
      fetchProfileCard();
    }
  }, [profile]);

  const fetchProfileCard = async () => {
    try {
      const res = await fetch('/api/profile/card');
      const data = await res.json();
      if (data.card) {
        setProfileCard(data.card);
        generateQRCodeForCard(data.card.slug);
      }
    } catch (error) {
      console.error('Error fetching profile card:', error);
    }
  };

  // Avatar handlers
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);

      // Generate preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUpload = async () => {
    if (!avatarFile) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', avatarFile);

      const res = await fetch('/api/profile/image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        await refreshProfile();
        setAvatarFile(null);
        setAvatarPreview(null);
        toast.success('Profile image uploaded successfully');
      } else {
        toast.error(data.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const res = await fetch('/api/profile/image', {
        method: 'DELETE',
      });

      if (res.ok) {
        await refreshProfile();
        toast.success('Profile image removed');
      } else {
        toast.error('Failed to remove image');
      }
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Failed to remove image');
    }
  };

  // Profile card handlers
  const handleGenerateCard = async () => {
    setGeneratingCard(true);
    try {
      const res = await fetch('/api/profile/card', {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        setProfileCard(data.card);
        generateQRCodeForCard(data.card.slug);
        toast.success('Profile card generated successfully!');
      } else {
        toast.error(data.error || 'Failed to generate profile card');
      }
    } catch (error) {
      console.error('Error generating profile card:', error);
      toast.error('Failed to generate profile card');
    } finally {
      setGeneratingCard(false);
    }
  };

  const handleRegenerateCard = async () => {
    if (!confirm('This will create a new URL and deactivate your old one. Continue?')) {
      return;
    }

    setGeneratingCard(true);
    try {
      const res = await fetch('/api/profile/card', {
        method: 'PATCH',
      });

      const data = await res.json();

      if (res.ok) {
        setProfileCard(data.card);
        generateQRCodeForCard(data.card.slug);
        toast.success('Profile card regenerated! Your old link is now inactive.');
      } else {
        toast.error(data.error || 'Failed to regenerate profile card');
      }
    } catch (error) {
      console.error('Error regenerating profile card:', error);
      toast.error('Failed to regenerate profile card');
    } finally {
      setGeneratingCard(false);
    }
  };

  const generateQRCodeForCard = async (slug: string) => {
    const url = `${window.location.origin}/share/profile/${slug}`;
    try {
      const qrCode = await generateQRCode(url);
      setQrCodeDataURL(qrCode);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleCopyURL = () => {
    if (!profileCard) return;

    const url = `${window.location.origin}/share/profile/${profileCard.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('URL copied to clipboard!');

    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    if (!qrCodeDataURL) return;
    downloadQRCode(qrCodeDataURL, `${profile?.full_name || 'profile'}-qr-code.png`);
    toast.success('QR code downloaded!');
  };

  const handleOpenPreview = () => {
    setShowPreview(true);
  };

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

          <Separator />

          {/* Profile Image Upload Section */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold flex items-center gap-2">
                <Upload className="w-4 h-4 text-muted-foreground" />
                Profile Image
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Upload a professional photo for your shareable profile card
              </p>
            </div>

            <div className="flex items-start gap-6">
              {/* Avatar Preview */}
              <div className="relative">
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/20 dark:to-gray-800 flex items-center justify-center overflow-hidden border-2 border-purple-200 dark:border-purple-700 shadow-lg">
                  {(avatarPreview || profile?.avatar_url) ? (
                    <img
                      src={avatarPreview || profile?.avatar_url || ''}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Upload className="w-12 h-12 text-purple-400" />
                  )}
                </div>

                {profile?.avatar_url && !avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-3">
                <div>
                  <Input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleAvatarChange}
                    className="cursor-pointer"
                    disabled={uploadingAvatar}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Accepted formats: JPEG, PNG, WebP. Max size: 5MB
                  </p>
                </div>

                {avatarFile && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleAvatarUpload}
                      disabled={uploadingAvatar}
                      className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    >
                      {uploadingAvatar ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Image
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview(null);
                      }}
                      disabled={uploadingAvatar}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
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

      {/* Shareable Profile Card Section */}
      <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-gray-900 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Share2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Shareable Profile Card</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Generate a public link to share your professional profile
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {!profileCard ? (
            // Generate Card CTA
            <div className="text-center py-8 px-4 space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Link2 className="w-10 h-10 text-purple-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Create Your Shareable Profile
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Generate a unique URL and QR code to share your professional profile with anyone. No login required for viewers.
                </p>
              </div>
              <Button
                onClick={handleGenerateCard}
                disabled={generatingCard}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              >
                {generatingCard ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" />
                    Generate Profile Card
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Card Generated - Show Actions
            <div className="space-y-6">
              {/* Stats */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Profile Views</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {profileCard.view_count || 0}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateCard}
                  disabled={generatingCard}
                  className="hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${generatingCard ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              </div>

              {/* Shareable URL */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Your Shareable Link</Label>
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-3 rounded-lg border-2 border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 font-mono text-sm truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/share/profile/${profileCard.slug}` : `/share/profile/${profileCard.slug}`}
                  </div>
                  <Button
                    onClick={handleCopyURL}
                    variant="outline"
                    className="border-2 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* QR Code */}
              {qrCodeDataURL && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">QR Code</Label>
                  <div className="flex items-start gap-4">
                    <div className="p-4 rounded-xl bg-white border-2 border-purple-200 dark:border-purple-700 shadow-sm">
                      <img
                        src={qrCodeDataURL}
                        alt="Profile QR Code"
                        className="w-40 h-40"
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Anyone can scan this QR code to view your profile instantly.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleDownloadQR}
                          variant="outline"
                          className="border-2 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                          <QrCode className="w-4 h-4 mr-2" />
                          Download QR
                        </Button>
                        <Button
                          onClick={handleOpenPreview}
                          variant="outline"
                          className="border-2 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Preview Card
                        </Button>
                        <Button
                          onClick={() => window.open(`/share/profile/${profileCard.slug}`, '_blank')}
                          variant="outline"
                          className="border-2 border-purple-200 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open in New Tab
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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

      {/* Profile Card Preview Modal */}
      {profile && (
        <ProfileCardPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          profile={profile}
        />
      )}
    </div>
  );
}
