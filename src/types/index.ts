/**
 * HTTP request method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE';

/**
 * Authentication types
 */
export type AuthType = 'no-auth' | 'api-key' | 'bearer-token' | 'basic-auth' | 'digest-auth' | 'oauth2';

/**
 * API Key configuration
 */
export interface ApiKeyConfig {
  key: string;
  value: string;
  addTo: 'header' | 'query';
}

/**
 * Bearer Token configuration
 */
export interface BearerTokenConfig {
  token: string;
}

/**
 * Basic Auth configuration
 */
export interface BasicAuthConfig {
  username: string;
  password: string;
}

/**
 * OAuth2 configuration
 */
export interface OAuth2Config {
  accessToken: string;
  tokenType: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  type: AuthType;
  apiKey?: ApiKeyConfig;
  bearerToken?: BearerTokenConfig;
  basicAuth?: BasicAuthConfig;
  oauth2?: OAuth2Config;
}

/**
 * Variable definition
 */
export interface Variable {
  /** Variable name */
  name: string;
  /** Variable value */
  value: string;
  /** Whether enabled */
  enabled: boolean;
}

/**
 * Header item
 */
export interface Header {
  /** Header name */
  key: string;
  /** Header value */
  value: string;
  /** Whether enabled */
  enabled: boolean;
}

/**
 * Request body types
 */
export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw';

/** Raw content subtype */
export type RawContentType = 'json' | 'text' | 'xml' | 'html' | 'javascript';

/**
 * Request body configuration
 */
export interface RequestBody {
  /** Type */
  type: BodyType;
  /** Content */
  content: string;
  /** Raw subtype (only when type='raw') */
  rawType?: RawContentType;
}

/**
 * HTTP request configuration
 */
export interface HttpRequest {
  /** Unique identifier */
  id: string;
  /** Request name */
  name: string;
  /** HTTP method */
  method: HttpMethod;
  /** Request URL */
  url: string;
  /** Headers list */
  headers: Header[];
  /** Request body */
  body: RequestBody;
  /** Authentication config */
  auth: AuthConfig;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry count (default 0, no retries) */
  retryCount?: number;
  /** Retry interval in milliseconds (default 1000) */
  retryDelay?: number;
  /** Creation time */
  createdAt: number;
  /** Update time */
  updatedAt: number;
}

/**
 * Partial request configuration (all fields optional)
 * Used when legacy data loaded from storage or migration may be missing fields
 */
export type PartialHttpRequest = Partial<HttpRequest>;

/**
 * HTTP response
 */
export interface HttpResponse {
  /** Status code */
  status: number;
  /** Status text */
  statusText: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body */
  body: string;
  /** Response time in milliseconds */
  time: number;
  /** Response size in bytes */
  size: number;
}

/**
 * History entry
 */
export interface HistoryEntry {
  /** Unique identifier */
  id: string;
  /** Request configuration */
  request: HttpRequest;
  /** Response data */
  response: HttpResponse | null;
  /** Timestamp */
  timestamp: number;
  /** Tab ID (for response cleanup) */
  tabId?: string;
}

/**
 * Export data format
 */
export interface ExportData {
  /** Version */
  version: string;
  /** Export time */
  exportedAt: number;
  /** History records */
  history: HistoryEntry[];
}

/**
 * Message types - popup to background
 */
export type MessageType = 'executeRequest' | 'getHistory' | 'clearHistory';

/**
 * Request execution message
 */
export interface ExecuteRequestMessage {
  type: 'executeRequest';
  request: HttpRequest;
}

/**
 * Message response
 */
export interface MessageResponse {
  success: boolean;
  data?: HttpResponse;
  error?: string;
}

/**
 * Tab metadata
 */
export interface Tab {
  /** Unique identifier, associated with HttpRequest.id */
  id: string;
  /** Display name (auto-generated: method + URL fragment) */
  name: string;
  /** Creation time */
  createdAt: number;
}

/**
 * Tab data storage structure
 */
export interface TabsData {
  /** List of tab metadata */
  tabs: Tab[];
  /** Request data mapping (id -> HttpRequest) */
  requests: Record<string, HttpRequest>;
  /** Response data mapping (id -> HttpResponse | null) */
  responses: Record<string, HttpResponse | null>;
  /** ID of the currently active tab */
  activeTabId: string | null;
  /** List of global variables */
  variables: Variable[];
}

// === Storage data structure extensions ===