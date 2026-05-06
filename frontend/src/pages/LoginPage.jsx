import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, AlertCircle, HeartPulse } from 'lucide-react';
import toast from 'react-hot-toast';
import { loginUser } from '../services/health.service';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';

const schema = z.object({
  email:    z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const res = await loginUser(data);
      login(res.data);
      toast.success(`Welcome back, ${res.data.user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      setServerError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center p-4 bg-background dark:bg-background-dark">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-md mb-4">
            <HeartPulse className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary dark:text-text-dark">Welcome back</h1>
          <p className="text-sm text-text-muted mt-1">Sign in to your HealthBot account</p>
        </div>

        <Card padding="lg" className="dark:border-border-dark">
          {/* Server error banner */}
          {serverError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-start gap-2.5 p-3.5 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm mb-5"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="relative">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                required
                error={errors.email?.message}
                autoComplete="email"
                {...register('email')}
              />
              <Mail className="absolute right-3 top-[34px] w-4 h-4 text-text-subtle pointer-events-none" />
            </div>

            <div className="relative">
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                required
                error={errors.password?.message}
                autoComplete="current-password"
                {...register('password')}
              />
              <Lock className="absolute right-3 top-[34px] w-4 h-4 text-text-subtle pointer-events-none" />
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              className="w-full mt-2"
              size="lg"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-text-muted mt-5">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Create one free
            </Link>
          </p>
        </Card>

        <p className="text-center text-xs text-text-subtle mt-6">
          By continuing, you agree to our{' '}
          <span className="underline cursor-pointer hover:text-text-muted transition-colors">Terms of Service</span>
          {' '}and{' '}
          <span className="underline cursor-pointer hover:text-text-muted transition-colors">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}
