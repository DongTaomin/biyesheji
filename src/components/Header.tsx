'use client';

import Link from 'next/link';
import Logo from './Logo';
import { Book, Globe, Users, Library, Settings, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIProviderSettings } from './AIProviderSettings';
import { ThemeToggle } from './ThemeToggle';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePathname } from 'next/navigation';

type HeaderProps = {
  children?: React.ReactNode;
};

export default function Header({ children }: HeaderProps) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  
  // 判断是否在写作页面（books/[bookId]路径）
  const isWritingPage = pathname?.startsWith('/books/');

  return (
    <header data-theme-scope="topbar" className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur-sm">
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
          {children}
        </div>
      </div>
    </header>
  );
}
