import { type ErrorResult, type SuccessResult } from '@/lib/action-result';

export type ActionState<TSuccess extends object = object, TErrorMeta extends object = object> =
  | { status: 'idle' | 'submitting' }
  | SuccessResult<TSuccess>
  | ErrorResult<TErrorMeta>;
