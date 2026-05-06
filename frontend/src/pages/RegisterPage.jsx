import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { User, Mail, Lock, MapPin, AlertCircle, HeartPulse, ChevronRight, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { registerUser } from '../services/health.service';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { cn } from '../lib/cn';

const schema = z.object({
  name:          z.string().min(2, 'Name must be at least 2 characters'),
  email:         z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password:      z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  age:           z.coerce.number().min(1).max(120).optional().or(z.literal('')),
  gender:        z.enum(['Male', 'Female', 'Other', 'Prefer not to say', '']).optional(),
  city:          z.string().max(80).optional(),
  medical_notes: z.string().max(500).optional(),
});

const steps = ['Account', 'Profile'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, trigger, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', age: '', gender: '', city: '', medical_notes: '' },
  });

  const nextStep = async () => {
    const valid = await trigger(['name', 'email', 'password']);
    if (valid) setStep(1);
  };

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const payload = { ...data, age: data.age ? Number(data.age) : null };
      const res = await registerUser(payload);
      login(res.data);
      toast.success(`Account created! Welcome, ${res.data.user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
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
          <h1 className="text-2xl font-bold text-text-primary dark:text-text-dark">Create your account</h1>
          <p className="text-sm text-text-muted mt-1">Free forever — no credit card required</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 px-1">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors',
                i <= step ? 'bg-primary text-white' : 'bg-border dark:bg-border-dark text-text-muted',
              )}>
                {i + 1}
              </div>
              <span className={cn(
                'text-xs font-medium transition-colors',
                i <= step ? 'text-primary' : 'text-text-muted',
              )}>
                {s}
              </span>
              {i < steps.length - 1 && (
                <div className={cn('flex-1 h-px transition-colors', i < step ? 'bg-primary' : 'bg-border dark:bg-border-dark')} />
              )}
            </div>
          ))}
        </div>

        <Card padding="lg">
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

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Step 0 — Account details */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="relative">
                  <Input label="Full name" placeholder="Nitish Kumar" required error={errors.name?.message} {...register('name')} />
                  <User className="absolute right-3 top-[34px] w-4 h-4 text-text-subtle pointer-events-none" />
                </div>
                <div className="relative">
                  <Input label="Email address" type="email" placeholder="you@example.com" required error={errors.email?.message} autoComplete="email" {...register('email')} />
                  <Mail className="absolute right-3 top-[34px] w-4 h-4 text-text-subtle pointer-events-none" />
                </div>
                <div className="relative">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Min. 8 chars, 1 uppercase, 1 number"
                    required
                    error={errors.password?.message}
                    autoComplete="new-password"
                    {...register('password')}
                  />
                  <Lock className="absolute right-3 top-[34px] w-4 h-4 text-text-subtle pointer-events-none" />
                </div>
                <Button type="button" onClick={nextStep} className="w-full mt-2" size="lg">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </motion.div>
            )}

            {/* Step 1 — Profile details */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Age" type="number" min="1" max="120" placeholder="25" error={errors.age?.message} {...register('age')} />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-text-primary dark:text-text-dark">Gender</label>
                    <select
                      className="h-10 px-3 rounded text-sm border border-border dark:border-border-dark bg-white dark:bg-surface-dark text-text-primary dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                      {...register('gender')}
                    >
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                      <option value="Prefer not to say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
                <div className="relative">
                  <Input label="City" placeholder="New Delhi" error={errors.city?.message} {...register('city')} />
                  <MapPin className="absolute right-3 top-[34px] w-4 h-4 text-text-subtle pointer-events-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-text-primary dark:text-text-dark">Medical notes</label>
                  <textarea
                    rows={3}
                    placeholder="Any allergies, chronic conditions, or medications… (optional)"
                    className="w-full px-3 py-2 rounded text-sm border border-border dark:border-border-dark bg-white dark:bg-surface-dark text-text-primary dark:text-text-dark placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors resize-none"
                    {...register('medical_notes')}
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <Button type="button" variant="secondary" onClick={() => setStep(0)} size="lg" className="flex-1">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </Button>
                  <Button type="submit" loading={isSubmitting} size="lg" className="flex-1">
                    {isSubmitting ? 'Creating…' : 'Create account'}
                  </Button>
                </div>
              </motion.div>
            )}
          </form>

          <p className="text-center text-sm text-text-muted mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
