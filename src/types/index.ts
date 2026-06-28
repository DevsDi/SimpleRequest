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
  /** Creation time */
  createdAt: number;
  /** Update time */
  updatedAt: number;
}

/**
 * 部分请求配置（字段可选）
 * 用于处理从存储加载或迁移的旧数据可能缺失字段的情况
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
 * Tab 元数据
 */
export interface Tab {
  /** 唯一标识，与 HttpRequest.id 关联 */
  id: string;
  /** 显示名称（自动生成：method + URL 片段） */
  name: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * Tabs 数据存储结构
 */
export interface TabsData {
  /** Tab 元数据列表 */
  tabs: Tab[];
  /** Request 数据映射 (id -> HttpRequest) */
  requests: Record<string, HttpRequest>;
  /** Response 数据映射 (id -> HttpResponse | null) */
  responses: Record<string, HttpResponse | null>;
  /** 当前激活的 Tab ID */
  activeTabId: string | null;
}