// src/lib/http-result.ts
import { NextResponse } from 'next/server';

import type { ActionResult } from '@/lib/action-result';

interface ApiSuccessBody<TData> {
  status: 'success';
  data: TData;
  message?: string;
}

interface ApiErrorBody {
  status: 'error' | 'not_found';
  message: string;
}

export function toJsonResponse<T extends object>(
  result: ActionResult<T>,
  options?: { statusOverride?: number },
) {
  if (result.status === 'success') {
    const { status: _status, message, ...data } = result;
    const body: ApiSuccessBody<typeof data> = {
      status: 'success',
      data,
      message,
    };
    return NextResponse.json(body, { status: options?.statusOverride ?? 200 });
  }

  if (result.status === 'not_found') {
    const body: ApiErrorBody = {
      status: 'not_found',
      message: result.message,
    };
    return NextResponse.json(body, { status: options?.statusOverride ?? 404 });
  }

  // error
  const body: ApiErrorBody = {
    status: 'error',
    message: result.message,
  };
  return NextResponse.json(body, { status: options?.statusOverride ?? 500 });
}
