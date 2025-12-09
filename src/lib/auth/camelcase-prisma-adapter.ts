// src/lib/auth/camelcase-prisma-adapter.ts
import { PrismaAdapter } from '@auth/prisma-adapter';

import type { Adapter, AdapterAccount } from 'next-auth/adapters';

function mapAccountToCamel(account: AdapterAccount): AdapterAccount {
  const { refresh_token, access_token, expires_at, token_type, id_token, session_state, ...rest } =
    account as AdapterAccount & {
      refresh_token?: string | null;
      access_token?: string | null;
      expires_at?: number | null;
      token_type?: string | null;
      id_token?: string | null;
      session_state?: string | null;
    };

  return {
    ...rest,
    refreshToken: account.refreshToken ?? refresh_token,
    accessToken: account.accessToken ?? access_token,
    expiresAt: account.expiresAt ?? expires_at,
    tokenType: account.tokenType ?? token_type,
    idToken: account.idToken ?? id_token,
    sessionState: account.sessionState ?? session_state,
  };
}

/**
 * PrismaAdapter wrapper that normalizes OAuth account fields
 * to camelCase so it works with a camelCase Prisma schema.
 */
export function CamelCasePrismaAdapter(prisma: unknown): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    // NextAuth passes snake_case tokens; map them to camelCase before persisting.
    linkAccount: base.linkAccount
      ? (account: AdapterAccount) => base.linkAccount!(mapAccountToCamel(account))
      : undefined,
  };
}
