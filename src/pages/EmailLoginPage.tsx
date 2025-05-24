import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Loader2, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
// import { supabase, getSessionWithDebug, clearAllSessionData, setSessionExpiry } from '@/lib/supabase';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function EmailLoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // checkUser(); // Temporarily disabled
    setIsLoading(false); // Assume loading is done as checkUser is disabled
  }, []);

  async function checkUser() {
    /* Temporarily disabled
    try {
      // First, verify Supabase configuration
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        console.error('Missing Supabase configuration');
        toast.error('Application configuration error. Please contact support.');
        setIsLoading(false);
        return;
      }

      const { session, error } = await getSessionWithDebug();
      
      if (error) {
        console.error('Error checking auth status:', error);
        toast.error('Error checking authentication status');
        return;
      }
      
      if (session?.user) {
        console.log('Active session found, checking employee data');
        const storedEmployee = sessionStorage.getItem('employee');
        
        if (storedEmployee) {
          console.log('Employee data found, redirecting to dashboard');
          navigate('/dashboard', { replace: true });
        } else {
          console.log('No employee data found, redirecting to employee code verification');
          navigate('/employee-code', { replace: true });
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      toast.error('Error checking authentication status');
    } finally {
      setIsLoading(false);
    }
    */
  }

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    /* Temporarily disabled
    try {
      console.log('Starting login process for:', data.email);
      
      // Verify Supabase configuration
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        throw new Error('Missing Supabase configuration');
      }
      
      console.log('Attempting login with email/password');
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (error) {
        console.error('Login error:', error);
        throw error;
      }

      if (!authData?.session) {
        console.error('No session created after login');
        throw new Error('No session created after login');
      }

      // Set session expiry based on remember me preference
      await setSessionExpiry(data.rememberMe);

      // At this point we know session exists
      const session = authData.session;
      console.log('Login successful:', {
        user: session.user.email,
        expires: session.expires_at 
          ? new Date(session.expires_at * 1000).toISOString()
          : 'No expiration set',
        provider: session.user.app_metadata.provider,
        lastSignIn: session.user.last_sign_in_at,
        rememberMe: data.rememberMe
      });

      // Verify session was properly stored
      const { session: verifySession } = await getSessionWithDebug();
      if (!verifySession) {
        console.error('Session verification failed after login');
        throw new Error('Session verification failed');
      }

      toast.success('Email authentication successful');
      
      // Navigate to employee code page
      navigate('/employee-code', { replace: true });
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(getErrorMessage(error));
      form.reset({ 
        email: data.email, 
        password: '', 
        rememberMe: data.rememberMe 
      });
    } finally {
      setIsSubmitting(false);
    }
    */
    toast.info('Login functionality is temporarily disabled.');
    setIsSubmitting(false);
  };

  const getErrorMessage = (error: any): string => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      return 'Application configuration error. Please contact support.';
    }

    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password. Please try again.';
      case 'Email not confirmed':
        return 'Please verify your email address before logging in.';
      case 'Too many requests':
        return 'Too many login attempts. Please try again later.';
      case 'Session verification failed':
        return 'Unable to create a secure session. Please try again.';
      case 'Missing Supabase configuration':
        return 'Application configuration error. Please contact support.';
      default:
        return `Authentication error: ${error.message || 'Unknown error'}`;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center text-muted-foreground">Loading...</div>
          <Progress value={100} className="w-full animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Heart className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Login to Kidney Match Pro
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Step 1: Email Authentication
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        {...field}
                        autoComplete="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        autoComplete="current-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Remember me for 7 days
                    </FormLabel>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Sign In
              </Button>
            </form>
          </Form>
        </div>

        <div className="text-center">
          <Button
            variant="link"
            className="text-sm text-muted-foreground"
            onClick={() => {
              // clearAllSessionData(); // Temporarily disabled
              // supabase.auth.signOut(); // Temporarily disabled
              navigate('/'); // Navigate to a safe root or landing page
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to main page
          </Button>
        </div>
      </div>
    </div>
  );
}