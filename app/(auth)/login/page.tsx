'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getClient } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Phone, ArrowRight, Sparkles, AlertCircle, Shield, ArrowLeft } from 'lucide-react';

import { OTPInput } from '@/components/ui/otp-input';
import { CountryCodePicker } from '@/components/ui/country-code-picker';

type AuthStep = 'identifier' | 'otp';

const ERROR_MESSAGES: Record<string, string> = {
  auth: 'Authentication failed. Please try again.',
  no_email: 'Could not retrieve email from your account.',
  domain_not_allowed: 'Invalid email domain. Please use a valid email address.',
  not_invited: 'Unregistered email ID. Please login with your registered email or contact admin for access.',
  access_denied: 'Access denied. Please try again.',
  not_admin: 'You are not an admin. Please login with an admin account or use regular login.',
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<AuthStep>('identifier');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiresIn, setOtpExpiresIn] = useState(300); // 5 minutes
  const [loadingMessage, setLoadingMessage] = useState<string>(''); // Clear status messages

  const supabase = getClient();

  // Handle error from URL params
  useEffect(() => {
    const errorCode = searchParams.get('error');
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      setError(ERROR_MESSAGES[errorCode]);
      toast.error(ERROR_MESSAGES[errorCode]);

      // Clear the error from URL so refresh doesn't show it again
      window.history.replaceState({}, '', '/login');
    }
  }, [searchParams]);

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN' && session) {
        toast.success('Signed in successfully!');
        router.push('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  // OTP expiry countdown
  useEffect(() => {
    if (step === 'otp' && otpExpiresIn > 0) {
      const timer = setInterval(() => {
        setOtpExpiresIn((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, otpExpiresIn]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  // Google Sign In
  const handleGoogleSignIn = async (mode: 'user' | 'admin' = 'user') => {
    if (mode === 'admin') {
      setAdminLoading(true);
    } else {
      setGoogleLoading(true);
    }
    setError(null);

    try {
      const redirectUrl =
        mode === 'admin'
          ? `${window.location.origin}/auth/callback/admin`
          : `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      toast.error(`Failed to sign in with Google: ${errorMessage}`);
      setError(errorMessage);
      setGoogleLoading(false);
      setAdminLoading(false);
    }
  };

  // Send OTP (Phone only)
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const identifier = `${countryCode}${phone}`;

    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    // ✅ OPTIMIZATION: Show OTP screen immediately (optimistic UI)
    setStep('otp');
    setLoading(true);
    setLoadingMessage('Sending verification code...');
    setError(null);

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          identifierType: 'phone',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Revert to identifier screen on error
        setStep('identifier');
        throw new Error(data.error || 'Failed to send OTP');
      }

      toast.success('Code sent! Check your phone');
      setOtpExpiresIn(data.expiresIn || 300);
    } catch (error: any) {
      setError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Verify OTP
  const handleVerifyOTP = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      toast.error('Please enter a valid 4-digit OTP');
      return;
    }

    const identifier = `${countryCode}${phone}`;

    setLoading(true);
    setLoadingMessage('Verifying code...');
    setError(null);

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          identifierType: 'phone',
          otp: otpCode,
          loginMode: 'user',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid OTP');
      }

      // ✅ OPTIMIZATION: Show clear progress message
      setLoadingMessage('Signing you in...');
      toast.success('Verified! Redirecting...');

      // Navigate to auth URL
      window.location.href = data.authUrl;
    } catch (error: any) {
      setError(error.message);
      toast.error(error.message);
      setLoadingMessage('');
      // Clear OTP on error
      setOtp(['', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async (retryType: 'text' | 'voice' = 'text') => {
    if (resendCooldown > 0) return;

    const identifier = `${countryCode}${phone}`;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/otp/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          identifierType: 'phone',
          retryType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend OTP');
      }

      toast.success(data.message || 'OTP resent successfully!');
      setResendCooldown(60); // 60 second cooldown
      setOtpExpiresIn(300); // Reset expiry
    } catch (error: any) {
      setError(error.message);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background dot-pattern">
      {/* Gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8 animate-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-bg mb-4 glow-sm">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Rethink Systems</h1>
          <p className="text-muted-foreground text-base mt-1">
            Your Learning Journey Starts Here
          </p>
        </div>

        {/* Loading Overlay */}
        {loadingMessage && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
            <div className="bg-card p-6 rounded-lg shadow-lg border border-border flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-lg font-medium">{loadingMessage}</p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4 animate-in-up">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="glass-strong animate-in-up stagger-1 border border-[hsl(172_66%_42%/0.3)] shadow-xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-4xl font-bold">
              {step === 'identifier' && 'Sign In to Your Account'}
              {step === 'otp' && 'Enter Verification Code'}
            </CardTitle>
            <CardDescription className="text-lg mt-2 text-foreground/60">
              {step === 'identifier' && 'Choose how you\'d like to sign in'}
              {step === 'otp' && `We sent a code to ${countryCode}${phone}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 transition-all duration-300 ease-in-out">
            {step === 'identifier' && (
              <>
                {/* Phone OTP Login */}
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-3">
                    <Label htmlFor="phone" className="text-base font-semibold">
                      Mobile Number
                    </Label>
                    <div className="flex gap-2">
                      <CountryCodePicker value={countryCode} onChange={setCountryCode} />
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="Enter your number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                          className="pl-10 h-12 text-base"
                          maxLength={10}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 gradient-bg hover:opacity-90 transition-opacity text-lg font-medium text-white disabled:opacity-60 !border !border-white/20"
                    disabled={loading || phone.length < 10}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      <>
                        Get Verification Code
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-base text-foreground/50 text-center">
                    We&apos;ll text you a 4-digit code
                  </p>
                </form>

                {/* Google Sign In */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="divider-gradient w-full" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-transparent px-3 text-foreground/40 font-medium">Or</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 !border !border-white/20 hover:!border-white/35 hover:bg-muted/50 transition-all text-lg font-medium"
                  onClick={() => handleGoogleSignIn('user')}
                  disabled={googleLoading || adminLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continue with Google
                </Button>

                <p className="text-base text-foreground/50 text-center">
                  Sign in with your registered email
                </p>

                {/* Admin Portal - Google Only */}
                <div className="relative pt-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="divider-gradient w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wider">
                    <span className="bg-transparent px-3 text-foreground/40 font-semibold">Admin Portal</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 !border !border-white/20 hover:bg-primary/10 hover:!border-primary/50 transition-all text-lg font-medium"
                  onClick={() => handleGoogleSignIn('admin')}
                  disabled={googleLoading || adminLoading}
                >
                  {adminLoading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Shield className="w-5 h-5 mr-2" />
                  )}
                  Sign in as Administrator
                </Button>

                <p className="text-sm text-foreground/40 text-center">
                  For administrators and team members only
                </p>
              </>
            )}

            {step === 'otp' && (
              <div className="space-y-6">
                {/* Back button */}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-base"
                  onClick={() => {
                    setStep('identifier');
                    setOtp(['', '', '', '']);
                  }}
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Try a different method
                </Button>

                {/* OTP Input */}
                <div className="space-y-4">
                  <OTPInput value={otp} onChange={setOtp} length={4} autoFocus disabled={loading} />

                  {/* Expiry timer */}
                  {otpExpiresIn > 0 ? (
                    <p className="text-sm text-center text-muted-foreground">
                      Code expires in {formatTime(otpExpiresIn)}
                    </p>
                  ) : (
                    <p className="text-sm text-center text-destructive">
                      Code expired. Please request a new one.
                    </p>
                  )}
                </div>

                {/* Verify button */}
                <Button
                  type="button"
                  className="w-full h-12 gradient-bg hover:opacity-90 transition-opacity text-lg font-medium"
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.join('').length !== 4 || otpExpiresIn === 0}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify Code
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>

                {/* Resend options */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleResendOTP('text')}
                      disabled={loading || resendCooldown > 0}
                    >
                      {resendCooldown > 0 ? `Resend SMS (${resendCooldown}s)` : 'Resend SMS'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleResendOTP('voice')}
                      disabled={loading || resendCooldown > 0}
                    >
                      Try Voice Call
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Didn&apos;t receive the code?
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-base text-muted-foreground mt-8 animate-in-up stagger-3 leading-relaxed">
          Questions? We&apos;re here to help
          <br />
          <a href="mailto:shravan@naum.systems" className="text-primary hover:underline font-medium">
            shravan@naum.systems
          </a>
        </p>

        {/* ✅ OPTIMIZATION: Prefetch dashboard for faster navigation */}
        <Link href="/dashboard" prefetch={true} className="hidden">
          Prefetch Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
