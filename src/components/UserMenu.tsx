'use client';

import { LogOut, UserCircle2 } from 'lucide-react';
import Link from 'next/link';

import { useAuth } from '@/hooks/useAuth';
import type { PublicUser } from '@/lib/auth-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function getInitials(username: string) {
  return username.trim().slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: { user: PublicUser }) {
  const { logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className='rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
        <Avatar className='h-8 w-8 border'>
          <AvatarImage src={user.avatar ?? undefined} alt={user.username} />
          <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-56'>
        <DropdownMenuLabel className='font-normal'>
          <div className='flex flex-col space-y-1'>
            <p className='text-sm font-medium leading-none'>{user.username}</p>
            <p className='text-xs leading-none text-muted-foreground'>{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href='/profile'>
            <UserCircle2 className='mr-2 h-4 w-4' />
            个人中心
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut className='mr-2 h-4 w-4' />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
