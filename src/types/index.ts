/**
 * HTTP请求方法类型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * 请求头项
 */
export interface Header {
  /** 头名称 */
  key: string;
  /** 头值 */
  value: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 请求体类型
 */
export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';

/**
 * 请求体配置
 */
export interface RequestBody {
  /** 类型 */
  type: BodyType;
  /** 内容 */
  content: string;
}

/**
 * HTTP请求配置
 */
export interface HttpRequest {
  /** 唯一标识 */
  id: string;
  /** 请求名称 */
  name: string;
  /** HTTP方法 */
  method: HttpMethod;
  /** 请求URL */
  url: string;
  /** 请求头列表 */
  headers: Header[];
  /** 请求体 */
  body: RequestBody;
  /** 超时时间(ms) */
  timeout?: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * HTTP响应
 */
export interface HttpResponse {
  /** 状态码 */
  status: number;
  /** 状态文本 */
  statusText: string;
  /** 响应头 */
  headers: Record<string, string>;
  /** 响应体 */
  body: string;
  /** 响应时间(ms) */
  time: number;
  /** 响应大小(bytes) */
  size: number;
}

/**
 * 历史记录条目
 */
export interface HistoryEntry {
  /** 唯一标识 */
  id: string;
  /** 请求配置 */
  request: HttpRequest;
  /** 响应数据 */
  response: HttpResponse | null;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 导出数据格式
 */
export interface ExportData {
  /** 版本 */
  version: string;
  /** 导出时间 */
  exportedAt: number;
  /** 历史记录 */
  history: HistoryEntry[];
}

/**
 * 消息类型 - popup发送给background
 */
export type MessageType = 'executeRequest' | 'getHistory' | 'clearHistory';

/**
 * 请求执行消息
 */
export interface ExecuteRequestMessage {
  type: 'executeRequest';
  request: HttpRequest;
}

/**
 * 消息响应
 */
export interface MessageResponse {
  success: boolean;
  data?: HttpResponse;
  error?: string;
}