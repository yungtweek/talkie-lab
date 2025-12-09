import { type ReactNode } from 'react';

import { SidebarToggle } from '@/components/sidebar-toggle';

export default function PromptsLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div className="overscroll-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
      <div className="overscroll-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y overflow-y-scroll">
        <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
          <SidebarToggle />
        </header>
        {children}
      </div>
    </div>
  );
}
