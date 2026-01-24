'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getClient } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Loader2, Mail, KeyRound, ArrowRight, Sparkles, AlertCircle, Shield } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type AuthStep = 'email' | 'otp' | 'password';

const ERROR_MESSAGES: Record<string, string> = {
  auth: 'Authentication failed. Please try again.',
  no_email: 'Could not retrieve email from your account.',
  domain_not_allowed: 'Only Gmail accounts (@gmail.com) are currently supported.',
  not_invited: 'Your email is not registered. Please contact the admin to get access.',
  access_denied: 'Access denied. Please try again.',
  not_admin: 'You do not have admin privileges. Please contact support.',
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = getClient();

  // Handle error from URL params
  useEffect(() => {
    const errorCode = searchParams.get('error');
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      setError(ERROR_MESSAGES[errorCode]);
      toast.error(ERROR_MESSAGES[errorCode]);
    }
  }, [searchParams]);

  // Check for existing session and listen for auth state changes (magic link handling)
  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push('/dashboard');
      }
    };
    checkSession();

    // Listen for auth state changes (handles magic link tokens in URL hash)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      console.log('Auth state change:', event);
      if (event === 'SIGNED_IN' && session) {
        toast.success('Signed in successfully!');
        router.push('/dashboard');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const [adminLoading, setAdminLoading] = useState(false);

  const handleGoogleSignIn = async (mode: 'user' | 'admin' = 'user') => {
    if (mode === 'admin') {
      setAdminLoading(true);
    } else {
      setGoogleLoading(true);
    }
    setError(null);

    try {
      // Use PATH-BASED routing for login mode
      // Query params get stripped by Supabase during OAuth, but paths are preserved
      // /auth/callback/admin -> admin login
      // /auth/callback -> user login
      const redirectUrl = mode === 'admin'
        ? `${window.location.origin}/auth/callback/admin`
        : `${window.location.origin}/auth/callback`;

      console.log('Login: OAuth redirectTo (path-based):', redirectUrl);

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
      toast.error('Failed to sign in with Google');
      console.error(error);
      setGoogleLoading(false);
      setAdminLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        console.error('OTP error:', error);
        if (error.message.includes('User not found') || error.message.includes('Signups not allowed')) {
          setError('Account not found. Please contact admin for access.');
          setLoading(false);
          return;
        }
        throw error;
      }

      toast.success('Check your email for the magic link!');
      setStep('otp');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to send magic link: ${errorMessage}`);
      console.error('Send OTP error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user?.id)
        .single();

      if (profile && !profile.full_name) {
        setIsNewUser(true);
        setStep('password');
        toast.success('Verified! Please set up your password');
      } else {
        toast.success('Welcome back!');
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error('Invalid verification code');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      toast.error('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      toast.error('Password must contain at least one number');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      toast.success('Password set successfully! Redirecting...');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to set password');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) throw error;
      toast.success('New login link sent to your email');
    } catch (error) {
      toast.error('Failed to resend link');
    } finally {
      setLoading(false);
    }
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
          <p className="text-muted-foreground text-base mt-1">Your Learning Journey Starts Here</p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-4 animate-in-up">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="glass-strong animate-in-up stagger-1">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl">
              {step === 'email' && 'Welcome Back'}
              {step === 'otp' && 'Check Your Inbox'}
              {step === 'password' && 'Secure Your Account'}
            </CardTitle>
            <CardDescription className="text-base">
              {step === 'email' && 'Sign in to continue your learning'}
              {step === 'otp' && 'A magic link is on its way!'}
              {step === 'password' && 'Create a password for quick access'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {step === 'email' && (
              <>
                {/* Email Input Form */}
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-base font-medium">Email address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="Enter your registered email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 text-base"
                        required
                      />
                    </div>
                  </div>

                  {/* Send OTP Button - Always visible */}
                  <Button
                    type="submit"
                    className="w-full gradient-bg hover:opacity-90 transition-opacity text-base"
                    disabled={loading || !email}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending link...
                      </>
                    ) : (
                      <>
                        Get Magic Link
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  {/* Helper microcopy */}
                  <p className="text-sm text-muted-foreground text-center">
                    We&apos;ll send a secure link to your email. No password needed.
                  </p>
                </form>

                {/* Google Sign In - Available for all emails (supports Google Workspace) */}
                {email && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <Separator className="w-full" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          Or sign in with
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 border-border hover:bg-muted/50 transition-all text-base"
                      onClick={() => handleGoogleSignIn('user')}
                      disabled={googleLoading || adminLoading}
                    >
                      {googleLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
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
                  </>
                )}

                {/* Admin Sign In - Always visible at bottom */}
                <div className="relative pt-2">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Admin Portal
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all text-base"
                  onClick={() => handleGoogleSignIn('admin')}
                  disabled={googleLoading || adminLoading}
                >
                  {adminLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  Sign in as Administrator
                </Button>

                {/* Admin helper text */}
                <p className="text-sm text-muted-foreground text-center">
                  For course managers and instructors
                </p>
              </>
            )}

            {step === 'otp' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-base text-muted-foreground">
                    We&apos;ve sent a secure sign-in link to:
                  </p>
                  <p className="text-base font-semibold mt-1">{email}</p>
                  <p className="text-base text-muted-foreground mt-3">
                    Click the link in your email to access your dashboard instantly.
                  </p>
                </div>

                {/* Tips section */}
                <div className="bg-muted/30 rounded-lg p-4 text-sm">
                  <p className="font-medium text-foreground mb-2">Didn&apos;t receive it?</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• Check your spam folder</li>
                    <li>• Make sure the email is correct</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between text-base pt-4">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Use different email
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-primary hover:underline"
                  >
                    {loading ? 'Sending...' : 'Resend link'}
                  </button>
                </div>
              </div>
            )}

            {step === 'password' && (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-base font-medium">Create password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="text-base"
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-base font-medium">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="text-base"
                    required
                  />
                </div>

                {/* Password requirements */}
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">Password requirements:</p>
                  <p className={password.length >= 8 ? 'text-green-500' : ''}>
                    {password.length >= 8 ? '✓' : '○'} At least 8 characters
                  </p>
                  <p className={/[A-Z]/.test(password) ? 'text-green-500' : ''}>
                    {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
                  </p>
                  <p className={/[0-9]/.test(password) ? 'text-green-500' : ''}>
                    {/[0-9]/.test(password) ? '✓' : '○'} One number
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-bg hover:opacity-90 transition-opacity text-base"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Complete Setup
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-base text-muted-foreground mt-6 animate-in-up stagger-3">
          Questions? We&apos;re here to help.{' '}
          <br className="sm:hidden" />
          Reach out at{' '}
          <a href="mailto:shravan@naum.systems" className="text-primary hover:underline">
            shravan@naum.systems
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
