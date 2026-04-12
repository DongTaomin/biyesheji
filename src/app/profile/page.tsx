'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { AlertCircle, ImagePlus, Loader2, Save, Trash2, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Header from '@/components/Header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { MAX_AVATAR_FILE_SIZE, MAX_BIO_LENGTH, type ProfileUpdatePayload } from '@/lib/auth-types';

const profileFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, '用户名至少 3 个字符')
    .max(20, '用户名最多 20 个字符')
    .regex(/^[\u4e00-\u9fa5\w]+$/, '用户名仅支持中文、字母、数字和下划线'),
  bio: z.string().trim().max(MAX_BIO_LENGTH, `简介不能超过 ${MAX_BIO_LENGTH} 个字符`).optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

function getInitials(username: string) {
  return username.trim().slice(0, 2).toUpperCase() || 'U';
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('头像读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('头像读取失败'));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { user, isLoading, logout, updateProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [avatarDirty, setAvatarDirty] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: '',
      bio: '',
    },
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    form.reset({
      username: user.username,
      bio: user.bio ?? '',
    });
    setAvatarPreview(user.avatar);
    setAvatarDirty(false);
    setFormError(null);
  }, [form, user]);

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setFormError(null);

    if (!file.type.startsWith('image/')) {
      setFormError('请选择图片文件作为头像');
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setFormError('头像原图不能超过 200KB');
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setAvatarPreview(dataUrl);
      setAvatarDirty(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '头像读取失败');
    }
  }

  function handleRemoveAvatar() {
    setAvatarPreview(null);
    setAvatarDirty(true);
    setFormError(null);
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) {
      setFormError('请先登录后再修改资料');
      return;
    }

    const normalizedUsername = values.username.trim();
    const normalizedBio = values.bio?.trim() || null;
    const hasUsernameChanged = normalizedUsername !== user.username;
    const hasBioChanged = normalizedBio !== (user.bio ?? null);
    const hasAvatarChanged = avatarDirty && avatarPreview !== (user.avatar ?? null);

    if (!hasUsernameChanged && !hasBioChanged && !hasAvatarChanged) {
      toast({ title: '暂无变更', description: '你还没有修改任何资料。' });
      return;
    }

    setFormError(null);

    const payload: ProfileUpdatePayload = {
      ...(hasUsernameChanged ? { username: normalizedUsername } : {}),
      ...(hasBioChanged ? { bio: normalizedBio } : {}),
      ...(hasAvatarChanged ? { avatar: avatarPreview } : {}),
    };

    const result = await updateProfile(payload);

    if (result.error) {
      setFormError(result.error);
      return;
    }

    setAvatarDirty(false);
    toast({ title: '资料已更新', description: '个人信息已同步到当前账号。' });
  });

  return (
    <div className='flex min-h-screen flex-col'>
      <Header />
      <main className='container mx-auto flex-1 p-4 md:p-6 lg:p-8'>
        <div className='mx-auto max-w-5xl space-y-6'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-bold font-headline'>个人中心</h1>
            <p className='text-sm text-muted-foreground'>管理你的公开资料、头像与账号基础信息。</p>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className='p-6 text-sm text-muted-foreground'>正在加载个人资料...</CardContent>
            </Card>
          ) : !user ? (
            <Card>
              <CardHeader>
                <CardTitle>你还没有登录</CardTitle>
                <CardDescription>请先使用右上角登录按钮登录账号，再进入个人中心管理资料。</CardDescription>
              </CardHeader>
              <CardContent className='flex gap-3'>
                <Button asChild>
                  <Link href='/'>返回首页</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className='grid gap-6 lg:grid-cols-[320px_1fr]'>
              <Card>
                <CardHeader>
                  <CardTitle>账号概览</CardTitle>
                  <CardDescription>当前账号的核心信息与快捷操作。</CardDescription>
                </CardHeader>
                <CardContent className='space-y-6'>
                  <div className='flex flex-col items-center gap-4 text-center'>
                    <Avatar className='h-24 w-24 border'>
                      <AvatarImage src={avatarPreview ?? undefined} alt={user.username} />
                      <AvatarFallback className='text-lg'>{getInitials(user.username)}</AvatarFallback>
                    </Avatar>
                    <div className='space-y-2'>
                      <div className='text-xl font-semibold'>{form.watch('username') || user.username}</div>
                      <div className='text-sm text-muted-foreground'>{user.email}</div>
                      <Badge variant='secondary'>{user.role}</Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className='space-y-3 text-sm'>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>注册时间</span>
                      <span>{format(new Date(user.createdAt), 'yyyy-MM-dd HH:mm')}</span>
                    </div>
                    <div className='flex items-start justify-between gap-3'>
                      <span className='text-muted-foreground'>简介</span>
                      <span className='max-w-[180px] text-right'>{form.watch('bio')?.trim() || '这个人很神秘，还没有留下简介。'}</span>
                    </div>
                  </div>

                  <Separator />

                  <Button variant='outline' className='w-full' onClick={() => void logout()}>
                    退出登录
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>编辑资料</CardTitle>
                  <CardDescription>支持修改用户名、简介，以及上传本地头像并以 Base64 形式保存。</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className='space-y-6'>
                    {formError ? (
                      <Alert variant='destructive'>
                        <AlertCircle className='h-4 w-4' />
                        <AlertTitle>保存失败</AlertTitle>
                        <AlertDescription>{formError}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className='space-y-3'>
                      <div className='text-sm font-medium'>头像</div>
                      <div className='flex flex-col gap-4 rounded-lg border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex items-center gap-4'>
                          <Avatar className='h-16 w-16 border'>
                            <AvatarImage src={avatarPreview ?? undefined} alt={user.username} />
                            <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                          </Avatar>
                          <div className='space-y-1 text-sm text-muted-foreground'>
                            <p>支持 PNG / JPG / WEBP / GIF</p>
                            <p>原图建议小于 200KB，服务端上限约 300KB</p>
                          </div>
                        </div>
                        <div className='flex gap-2'>
                          <input
                            ref={fileInputRef}
                            type='file'
                            accept='image/png,image/jpeg,image/webp,image/gif'
                            className='hidden'
                            onChange={handleAvatarChange}
                          />
                          <Button type='button' variant='outline' onClick={() => fileInputRef.current?.click()}>
                            <ImagePlus className='mr-2 h-4 w-4' />
                            上传头像
                          </Button>
                          <Button type='button' variant='ghost' onClick={handleRemoveAvatar}>
                            <Trash2 className='mr-2 h-4 w-4' />
                            移除
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Form {...form}>
                      <form onSubmit={onSubmit} className='space-y-5'>
                        <FormField
                          control={form.control}
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
                          control={form.control}
                          name='bio'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>简介</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder='介绍一下你自己、喜欢的题材或创作方向'
                                  className='min-h-[140px]'
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <div className='flex justify-between text-xs text-muted-foreground'>
                                <span>会展示在你的个人中心与后续社区资料中</span>
                                <span>{field.value?.length ?? 0}/{MAX_BIO_LENGTH}</span>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className='flex flex-col gap-3 sm:flex-row sm:justify-end'>
                          <Button type='submit' disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? (
                              <>
                                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                                保存中...
                              </>
                            ) : (
                              <>
                                <Save className='mr-2 h-4 w-4' />
                                保存资料
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
