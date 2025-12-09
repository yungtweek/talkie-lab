// Lightweight result helpers to keep action return shapes consistent.
export type ResultStatus = 'success' | 'error' | 'not_found';

export interface BaseResult {
  status: ResultStatus;
}

export type SuccessResult<T extends object = object> = BaseResult & {
  status: 'success';
  message?: string;
} & T;
export type ErrorResult<T extends object = object> = BaseResult & {
  status: 'error';
  message: string;
} & T;
export type NotFoundResult<T extends object = object> = BaseResult & {
  status: 'not_found';
  message: string;
} & T;

export type ActionResult<T extends object = object> =
  | SuccessResult<T>
  | ErrorResult<T>
  | NotFoundResult<T>;

export function success<T extends object = object>(payload?: T): SuccessResult<T> {
  return { status: 'success', ...(payload ?? {}) } as SuccessResult<T>;
}

export function error<T extends object = object>(message: string, extras?: T): ErrorResult<T> {
  return { status: 'error', message: message, ...(extras ?? {}) } as ErrorResult<T>;
}

export function notFound<T extends object = object>(
  message = 'Not found',
  extras?: T,
): NotFoundResult<T> {
  return { status: 'not_found', message: message, ...(extras ?? {}) } as NotFoundResult<T>;
}
