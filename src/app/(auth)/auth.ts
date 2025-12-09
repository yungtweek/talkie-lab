// src/app/(auth)/auth.ts
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

import { CamelCasePrismaAdapter } from '@/lib/auth/camelcase-prisma-adapter';
import { prisma } from '@/lib/prisma';

import type { NextAuthConfig } from 'next-auth';

export type UserType = 'guest' | 'regular';

declare module 'next-auth' {
  interface User {
    id?: string;
    image?: string | null;
    email?: string | null;
    type?: UserType;
  }

  interface Session {
    user?: {
      id?: string;
      image?: string | null;
      email?: string | null;
      type?: UserType;
    };
  }
}

const config: NextAuthConfig = {
  adapter: CamelCasePrismaAdapter(prisma),
  session: {
    strategy: 'database',
  },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        if (user && user.id) {
          session.user.id = user.id;
        }
        session.user.type = user?.type ?? 'regular';
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
