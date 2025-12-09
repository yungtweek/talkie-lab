import type { Metadata } from 'next';

import { Nanum_Gothic } from 'next/font/google';

import './globals.css';

import { dehydrate, HydrationBoundary, queryOptions } from '@tanstack/react-query';
import { cookies } from 'next/headers';
import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { Toaster } from 'sonner';

import { auth } from '@/app/(auth)/auth';
import { listConversationsAction } from '@/app/(chat)/chat/actions';
import AppSidebar from '@/components/app-sidebar';
import { QueryProvider } from '@/components/query-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getQueryClient } from '@/lib/query-client';

export const metadata: Metadata = {
  title: 'Talkie-lab',
  description:
    'An experimental workspace for building and observing LLM-powered chat and agent systems.',
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [session] = await Promise.all([auth()]);

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    queryOptions({
      queryKey: ['conversations'],
      queryFn: () => listConversationsAction(),
    }),
  );

  return (
    <html
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required"
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      {/*<body className="antialiased">*/}
      <body className="subpixel-antialiased">
        {/*<Providers>*/}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <SessionProvider>
              <HydrationBoundary state={dehydrate(queryClient)}>
                <SidebarProvider>
                  <AppSidebar user={session?.user} />
                  <SidebarInset>{children}</SidebarInset>
                  <Toaster position="top-center" />
                </SidebarProvider>
              </HydrationBoundary>
            </SessionProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
