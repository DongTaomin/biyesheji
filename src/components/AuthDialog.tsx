'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const loginSchema = z.object({
  email: z.string().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少 8 位'),
});

const registerSchema = z
  .object({
    email: z.string().email('请输入有效邮箱'),
    username: z
      .string()
      .trim()
      .min(3, '用户名至少 3 个字符')
      .max(20, '用户名最多 20 个字符')
      .regex(/^[\u4e00-\u9fa5\w]+$/, '用户名仅支持中文、字母、数字和下划线'),
    password: z.string().min(8, '密码至少 8 位'),
    confirmPassword: z.string().min(8, '确认密码至少 8 位'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的密码不一致',
  });

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!open) {
      setError(null);
      loginForm.reset();
      registerForm.reset();
      setTab('login');
    }
  }, [loginForm, open, registerForm]);

  const handleLogin = loginForm.handleSubmit(async (values) => {
    setError(null);
    const result = await login(values.email, values.password);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast({ title: '登录成功' });
    onOpenChange(false);
  });

  const handleRegister = registerForm.handleSubmit(async (values) => {
    setError(null);
    const result = await register(values.email, values.username, values.password);

    if (result.error) {
      setError(result.error);
      return;
    }

    toast({ title: `注册成功，欢迎 ${values.username}` });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>账号中心</DialogTitle>
          <DialogDescription>登录后即可拥有独立账号体系，后续可扩展社区与云同步功能。</DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs value={tab} onValueChange={(value) => setTab(value as 'login' | 'register')} className='w-full'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='login'>登录</TabsTrigger>
            <TabsTrigger value='register'>注册</TabsTrigger>
          </TabsList>

          <TabsContent value='login'>
            <Form {...loginForm}>
              <form onSubmit={handleLogin} className='space-y-4'>
                <FormField
                  control={loginForm.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱</FormLabel>
                      <FormControl>
                        <Input placeholder='you@example.com' type='email' autoComplete='email' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码</FormLabel>
                      <FormControl>
                        <Input placeholder='请输入密码' type='password' autoComplete='current-password' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button className='w-full' type='submit' disabled={loginForm.formState.isSubmitting}>
                  {loginForm.formState.isSubmitting ? '登录中...' : '登录'}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value='register'>
            <Form {...registerForm}>
              <form onSubmit={handleRegister} className='space-y-4'>
                <FormField
                  control={registerForm.control}
                  name='email'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>邮箱</FormLabel>
                      <FormControl>
                        <Input placeholder='you@example.com' type='email' autoComplete='email' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name='username'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>用户名</FormLabel>
                      <FormControl>
                        <Input placeholder='请输入用户名' autoComplete='username' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name='password'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>密码</FormLabel>
                      <FormControl>
                        <Input placeholder='请输入密码' type='password' autoComplete='new-password' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={registerForm.control}
                  name='confirmPassword'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>确认密码</FormLabel>
                      <FormControl>
                        <Input placeholder='请再次输入密码' type='password' autoComplete='new-password' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button className='w-full' type='submit' disabled={registerForm.formState.isSubmitting}>
                  {registerForm.formState.isSubmitting ? '注册中...' : '注册'}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
