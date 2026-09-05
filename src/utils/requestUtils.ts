import { HttpRequest, AuthConfig, PartialHttpRequest } from '@/types';
import { DEFAULT_REQUEST, DEFAULT_AUTH, DEFAULT_TIMEOUT } from '@/utils/constants';

/**
 * Normalize the authentication configuration
 * Ensures the auth object exists and has the required fields
 * @param auth Possibly incomplete authentication configuration
 * @returns A complete AuthConfig object
 */
function normalizeAuth(auth: AuthConfig | undefined): AuthConfig {
  if (!auth) return DEFAULT_AUTH;
  return auth;
}

/**
 * Normalize a request object, ensuring all required fields exist
 * Handles old data loaded from storage or migration that may be missing fields
 * @param partial A request object that may be missing fields
 * @returns A complete HttpRequest object
 */
export function normalizeRequest(partial: PartialHttpRequest): HttpRequest {
  const now = Date.now();

  return {
    id: partial.id ?? '',
    name: partial.name ?? '',
    method: partial.method ?? 'GET',
    url: partial.url ?? '',
    headers: partial.headers ?? [],
    body: {
      type: partial.body?.type ?? 'raw',
      content: partial.body?.content ?? '',
      rawType: partial.body?.rawType ?? 'json',
    },
    auth: normalizeAuth(partial.auth),
    timeout: partial.timeout ?? DEFAULT_TIMEOUT,
    retryCount: partial.retryCount ?? 0,
    retryDelay: partial.retryDelay ?? 1000,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}