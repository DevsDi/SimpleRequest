/**
 * 应用常量配置
 */

import { Header, HttpRequest } from '@/types';

/** 最大历史记录条数 */
export const MAX_HISTORY_ITEMS = 100;

/** 单条响应最大大小 2MB */
export const MAX_RESPONSE_SIZE = 2 * 1024 * 1024;

/** 默认超时时间 30秒 */
export const DEFAULT_TIMEOUT = 30000;

/** HTTP方法列表 */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

/** 请求体类型列表 */
export const BODY_TYPES = ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw'] as const;

/** 请求体类型 */
export type BodyType = typeof BODY_TYPES[number];

/** 常用请求头预设 */
export const COMMON_HEADERS: Header[] = [
  { key: 'Content-Type', value: 'application/json', enabled: true },
  { key: 'Accept', value: 'application/json', enabled: true },
  { key: 'Authorization', value: 'Bearer <token>', enabled: false },
];

/** 常用请求头名称列表 - 用于自动联想 */
export const HEADER_SUGGESTIONS: { key: string; description: string }[] = [
  { key: 'Accept', description: '指定客户端能够接收的内容类型' },
  { key: 'Accept-Encoding', description: '指定客户端能够支持的编码方式' },
  { key: 'Accept-Language', description: '指定客户端能够接受的语言' },
  { key: 'Authorization', description: '包含用于验证用户身份的凭证' },
  { key: 'Cache-Control', description: '控制缓存行为' },
  { key: 'Content-Type', description: '指定请求或响应体的媒体类型' },
  { key: 'Cookie', description: '发送Cookie到服务器' },
  { key: 'Host', description: '指定请求的目标主机' },
  { key: 'Origin', description: '指示请求来源' },
  { key: 'Referer', description: '指示请求来源页面' },
  { key: 'User-Agent', description: '标识客户端软件信息' },
  { key: 'X-Requested-With', description: '标识Ajax请求' },
  { key: 'X-API-Key', description: 'API密钥' },
  { key: 'X-Auth-Token', description: '认证令牌' },
  { key: 'X-CSRF-Token', description: 'CSRF防护令牌' },
  { key: 'Access-Control-Allow-Origin', description: 'CORS允许的源' },
  { key: 'Access-Control-Allow-Methods', description: 'CORS允许的方法' },
  { key: 'Access-Control-Allow-Headers', description: 'CORS允许的请求头' },
  { key: 'If-Match', description: '条件请求 - 匹配ETag' },
  { key: 'If-None-Match', description: '条件请求 - 不匹配ETag' },
  { key: 'If-Modified-Since', description: '条件请求 - 修改时间检查' },
  { key: 'Range', description: '请求部分内容' },
  { key: 'Connection', description: '控制网络连接' },
  { key: 'Content-Length', description: '请求体长度' },
  { key: 'Date', description: '请求发送时间' },
  { key: 'Expect', description: '期望的服务器行为' },
  { key: 'From', description: '请求发起者邮箱' },
  { key: 'Max-Forwards', description: '代理转发次数限制' },
  { key: 'Pragma', description: '特殊指令' },
  { key: 'Proxy-Authorization', description: '代理认证凭证' },
  { key: 'TE', description: '传输编码要求' },
  { key: 'Upgrade', description: '协议升级请求' },
  { key: 'Via', description: '代理信息' },
  { key: 'Warning', description: '警告信息' },
];

/** 默认请求配置 */
export const DEFAULT_REQUEST: HttpRequest = {
  id: '',
  name: '',
  method: 'GET',
  url: '',
  headers: [],
  body: { type: 'none', content: '' },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};