import { HttpRequest, AuthConfig, PartialHttpRequest } from '@/types';
import { DEFAULT_REQUEST, DEFAULT_AUTH } from '@/utils/constants';

/**
 * 规范化认证配置
 * 确保 auth 对象存在且具有必需字段
 * @param auth 可能不完整的认证配置
 * @returns 完整的 AuthConfig 对象
 */
function normalizeAuth(auth: AuthConfig | undefined): AuthConfig {
  if (!auth) return DEFAULT_AUTH;
  return auth;
}

/**
 * 规范化请求对象，确保所有必需字段存在
 * 用于处理从存储加载或迁移的旧数据可能缺失字段的情况
 * @param partial 可能缺失字段的请求对象
 * @returns 完整的 HttpRequest 对象
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
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}
