'use client';

import { AuthDialog } from '@/components/AuthDialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { AIProviderSettings } from './AIProviderSettings';
import Logo from './Logo';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

type HeaderProps = {
  children?: React.ReactNode;
};

export default function Header({ children }: HeaderProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  // 判断是否在写作页面（books/[bookId]路径）
  const isWritingPage = pathname?.startsWith('/books/');

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-2 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/">
              <Logo hideText={isMobile} />
            </Link>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {/* 写作页面已经有AI配置，不再重复显示 */}
          {!isWritingPage && <AIProviderSettings variant="ghost" showStatus={true} />}
          {isLoading ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : user ? (
            <UserMenu user={user} />
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setAuthDialogOpen(true)}>
              登录
            </Button>
          )}
          {children}
        </div>
      </div>
      <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </header>
  );
}
