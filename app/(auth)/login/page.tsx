'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Mail, KeyRound, ArrowRight, Sparkles, Play } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type AuthStep = 'email' | 'otp' | 'password';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const supabase = getClient();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        // If user doesn't exist, this might be a first-time login
        if (error.message.includes('User not found')) {
          toast.error('Account not found. Please contact admin for an invite.');
          setLoading(false);
          return;
        }
        throw error;
      }

      toast.success('Check your email for the verification code');
      setStep('otp');
    } catch (error) {
      toast.error('Failed to send verification code');
      console.error(error);
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

      // Check if user needs to set password (first time login)
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

    // Validate password
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
        },
      });

      if (error) throw error;
      toast.success('New code sent to your email');
    } catch (error) {
      toast.error('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // Store demo user flag in localStorage
    localStorage.setItem('demo_user', 'true');
    toast.success('Welcome to the demo!');
    router.push('/dashboard');
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
          <h1 className="text-2xl font-bold gradient-text">Rethink Systems</h1>
          <p className="text-muted-foreground text-sm mt-1">Learning Dashboard</p>
        </div>

        <Card className="glass-strong animate-in-up stagger-1">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {step === 'email' && 'Welcome back'}
              {step === 'otp' && 'Verify your email'}
              {step === 'password' && 'Set your password'}
            </CardTitle>
            <CardDescription>
              {step === 'email' && 'Enter your email to continue'}
              {step === 'otp' && `We sent a code to ${email}`}
              {step === 'password' && 'Create a secure password for your account'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {step === 'email' && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-bg hover:opacity-90 transition-opacity"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp">Verification code</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="pl-10 text-center tracking-widest text-lg font-mono"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-bg hover:opacity-90 transition-opacity"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify code
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between text-sm">
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
                    Resend code
                  </button>
                </div>
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={handleSetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                {/* Password requirements */}
                <div className="text-xs space-y-1 text-muted-foreground">
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
                  className="w-full gradient-bg hover:opacity-90 transition-opacity"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      Complete setup
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Demo Login Option */}
        <div className="mt-6 animate-in-up stagger-2">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or try without account
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full mt-4 border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all"
            onClick={handleDemoLogin}
          >
            <Play className="w-4 h-4 mr-2" />
            Try Demo
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6 animate-in-up stagger-3">
          Need help? Contact{' '}
          <a href="mailto:support@rethink.systems" className="text-primary hover:underline">
            support@rethink.systems
          </a>
        </p>
      </div>
    </div>
  );
}
