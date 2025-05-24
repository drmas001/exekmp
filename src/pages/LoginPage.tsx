import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
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
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
// import { loginWithEmployeeCode } from '@/lib/api/auth';
import { employeeCodeSchema } from '@/lib/validations/employee';

const loginSchema = z.object({
  employeeCode: employeeCodeSchema,
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      employeeCode: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    console.log('Login attempt with employee code (feature disabled):', data.employeeCode);
    toast.info('Employee code login is currently disabled.');
    setIsLoading(false);
    form.reset();
  };

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
            Access dashboard using your unique Employee Code
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee Code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your employee code"
                        {...field}
                        disabled={isLoading}
                        autoComplete="off"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? 'Verifying...' : 'Login'}
              </Button>
            </form>
          </Form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Contact your administrator if you need assistance
        </p>
      </div>
    </div>
  );
}