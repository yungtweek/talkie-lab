'use client';

import { SquarePen, SquareTerminal } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type User } from 'next-auth';
import React, { Suspense } from 'react';

import { NavHistory } from '@/components/nav-history';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const items = {
  chat: {
    title: 'Chat',
    url: '/',
    icon: SquarePen,
  },
  prompts: {
    title: 'Prompts',
    url: '/prompts',
    icon: SquareTerminal,
  },
};
const { chat, prompts } = items;

export default function AppSidebar({ user }: { user: User | undefined }) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Playground</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    className={cn(
                      'items-center',
                      pathname === chat.url
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50',
                    )}
                    href={chat.url}
                  >
                    <chat.icon />
                    {chat.title}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Suspense fallback={null}>
                  <NavHistory />
                </Suspense>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    className={cn(
                      'items-center',
                      pathname === prompts.url
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50',
                    )}
                    href={prompts.url}
                  >
                    <prompts.icon />
                    {prompts.title}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
