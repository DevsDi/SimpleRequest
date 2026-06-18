/**
 * Application constants configuration
 */

import { Header, HttpRequest, AuthConfig } from '@/types';

/** Maximum history entries */
export const MAX_HISTORY_ITEMS = 100;

/** Maximum single response size 2MB */
export const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

/** Default timeout 30 seconds */
export const DEFAULT_TIMEOUT = 30000;

/** Variable syntax regex - matches {{variableName}} */
export const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g;

/** Domain prefixes that should use HTTP protocol */
export const HTTP_DOMAIN_PREFIXES = ['localhost', '127.0.0.1', '192.168.'];

/** HTTP methods list */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

/** Body types list */
export const BODY_TYPES = ['none', 'form-data', 'x-www-form-urlencoded', 'raw'] as const;

/** Body type */
export type BodyType = typeof BODY_TYPES[number];

/** Common headers presets */
export const COMMON_HEADERS: Header[] = [
  { key: 'Content-Type', value: 'application/json', enabled: true },
  { key: 'Accept', value: 'application/json', enabled: true },
  { key: 'Authorization', value: 'Bearer <token>', enabled: false },
];

/** Common header names list - for autocomplete suggestions */
export const HEADER_SUGGESTIONS: { key: string; description: string }[] = [
  { key: 'Accept', description: 'Content types the client can accept' },
  { key: 'Accept-Encoding', description: 'Encoding algorithms the client supports' },
  { key: 'Accept-Language', description: 'Languages the client can accept' },
  { key: 'Authorization', description: 'Credentials for user authentication' },
  { key: 'Cache-Control', description: 'Cache behavior directives' },
  { key: 'Content-Type', description: 'Media type of request/response body' },
  { key: 'Cookie', description: 'Send cookies to the server' },
  { key: 'Host', description: 'Target host of the request' },
  { key: 'Origin', description: 'Indicates request origin' },
  { key: 'Referer', description: 'Indicates referring page' },
  { key: 'User-Agent', description: 'Client software identifier' },
  { key: 'X-Requested-With', description: 'Identifies Ajax request' },
  { key: 'X-API-Key', description: 'API key' },
  { key: 'X-Auth-Token', description: 'Authentication token' },
  { key: 'X-CSRF-Token', description: 'CSRF protection token' },
  { key: 'Access-Control-Allow-Origin', description: 'CORS allowed origin' },
  { key: 'Access-Control-Allow-Methods', description: 'CORS allowed methods' },
  { key: 'Access-Control-Allow-Headers', description: 'CORS allowed headers' },
  { key: 'If-Match', description: 'Conditional request - match ETag' },
  { key: 'If-None-Match', description: 'Conditional request - not match ETag' },
  { key: 'If-Modified-Since', description: 'Conditional request - modification time check' },
  { key: 'Range', description: 'Request partial content' },
  { key: 'Connection', description: 'Control network connection' },
  { key: 'Content-Length', description: 'Request body length' },
  { key: 'Date', description: 'Request send time' },
  { key: 'Expect', description: 'Expected server behavior' },
  { key: 'From', description: 'Request originator email' },
  { key: 'Max-Forwards', description: 'Proxy forwarding limit' },
  { key: 'Pragma', description: 'Special directives' },
  { key: 'Proxy-Authorization', description: 'Proxy authentication credentials' },
  { key: 'TE', description: 'Transfer encoding requirements' },
  { key: 'Upgrade', description: 'Protocol upgrade request' },
  { key: 'Via', description: 'Proxy information' },
  { key: 'Warning', description: 'Warning information' },
];

/** Default auth config */
export const DEFAULT_AUTH: AuthConfig = {
  type: 'no-auth'
};

/** Default request config */
export const DEFAULT_REQUEST: HttpRequest = {
  id: '',
  name: '',
  method: 'GET',
  url: '',
  headers: [],
  body: { type: 'raw', content: '', rawType: 'json' },
  auth: DEFAULT_AUTH,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};