/**
 * Background Service Worker
 * 处理跨域HTTP请求和消息传递
 */

import { ExecuteRequestMessage, HttpResponse, AuthConfig } from '@/types';

// 点击图标打开新标签页
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/popup/popup.html'),
  });
});

/**
 * 监听来自popup的消息
 */
chrome.runtime.onMessage.addListener(
  (message: ExecuteRequestMessage, _sender, sendResponse) => {
    if (message.type === 'executeRequest') {
      // 异步处理请求
      executeRequest(message.request)
        .then((response) => {
          sendResponse({ success: true, data: response });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      // 返回true表示异步响应
      return true;
    }
  }
);

/**
 * 根据认证配置生成请求头
 */
function buildAuthHeaders(auth: AuthConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!auth || auth.type === 'no-auth') {
    return headers;
  }

  switch (auth.type) {
    case 'api-key':
      if (auth.apiKey?.key && auth.apiKey?.value) {
        // API Key 添加到 header
        headers[auth.apiKey.key] = auth.apiKey.value;
      }
      break;

    case 'bearer-token':
      if (auth.bearerToken?.token) {
        headers['authorization'] = `Bearer ${auth.bearerToken.token}`;
      }
      break;

    case 'basic-auth':
      if (auth.basicAuth?.username) {
        const credentials = btoa(`${auth.basicAuth.username}:${auth.basicAuth.password || ''}`);
        headers['authorization'] = `Basic ${credentials}`;
      }
      break;

    case 'oauth2':
      if (auth.oauth2?.accessToken) {
        const tokenType = auth.oauth2.tokenType || 'Bearer';
        headers['authorization'] = `${tokenType} ${auth.oauth2.accessToken}`;
      }
      break;
  }

  return headers;
}

/**
 * 根据认证配置修改 URL（添加 query 参数）
 */
function applyAuthToUrl(url: string, auth: AuthConfig): string {
  if (!auth || auth.type !== 'api-key') {
    return url;
  }

  if (auth.apiKey?.addTo === 'query' && auth.apiKey?.key && auth.apiKey?.value) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${encodeURIComponent(auth.apiKey.key)}=${encodeURIComponent(auth.apiKey.value)}`;
  }

  return url;
}

/**
 * 智能添加默认请求头
 */
function buildHeaders(request: HttpRequestInternal, hasFormDataBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};

  // 1. 添加认证头
  const authHeaders = buildAuthHeaders(request.auth);
  Object.assign(headers, authHeaders);

  // 2. 添加用户自定义的启用请求头（不覆盖认证头）
  request.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      const key = h.key.toLowerCase();
      if (!headers[key]) {
        headers[key] = h.value;
      }
    });

  // 3. 智能添加默认请求头（用户未设置时）

  // Content-Type: 根据body类型自动设置
  if (!hasFormDataBody && request.body.type !== 'none' && request.body.content.trim()) {
    const contentTypeKey = 'content-type';
    if (!headers[contentTypeKey]) {
      switch (request.body.type) {
        case 'json':
          headers[contentTypeKey] = 'application/json';
          break;
        case 'x-www-form-urlencoded':
          headers[contentTypeKey] = 'application/x-www-form-urlencoded';
          break;
        case 'raw':
          headers[contentTypeKey] = 'text/plain';
          break;
      }
    }
  }

  // Accept: 默认接受JSON
  const acceptKey = 'accept';
  if (!headers[acceptKey]) {
    headers[acceptKey] = 'application/json, text/plain, */*';
  }

  // User-Agent: 添加标识
  const userAgentKey = 'user-agent';
  if (!headers[userAgentKey]) {
    headers[userAgentKey] = 'SimpleRequest/1.0.0';
  }

  return headers;
}

/**
 * 解析 form-data 内容为 FormData 对象
 */
function parseFormDataContent(content: string): FormData {
  const formData = new FormData();
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key.trim()) {
      formData.append(key.trim(), value || '');
    }
  }

  return formData;
}

/**
 * 解析 x-www-form-urlencoded 内容为 URLSearchParams
 */
function parseUrlencodedContent(content: string): URLSearchParams {
  const params = new URLSearchParams();
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key.trim()) {
      params.append(key.trim(), value || '');
    }
  }

  return params;
}

/**
 * 执行HTTP请求
 */
async function executeRequest(request: HttpRequestInternal): Promise<HttpResponse> {
  const startTime = Date.now();

  try {
    // 应用认证到 URL（API Key query 参数）
    let url = applyAuthToUrl(request.url, request.auth);

    // 构建请求体
    let body: string | FormData | URLSearchParams | undefined = undefined;
    let hasFormDataBody = false;

    if (request.body.type !== 'none' && request.body.content.trim()) {
      switch (request.body.type) {
        case 'form-data':
          body = parseFormDataContent(request.body.content);
          hasFormDataBody = true;
          break;
        case 'x-www-form-urlencoded':
          body = parseUrlencodedContent(request.body.content);
          break;
        default:
          body = request.body.content;
          break;
      }
    }

    // 构建请求头（包含认证）
    const headers = buildHeaders(request, hasFormDataBody);

    // 发起请求
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: body,
    });

    const endTime = Date.now();

    // 解析响应
    const responseBody = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      time: endTime - startTime,
      size: responseBody.length,
    };
  } catch (error: any) {
    throw new Error(error.message || '请求失败');
  }
}

/**
 * HTTP请求类型(background内部使用)
 */
interface HttpRequestInternal {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  body: { type: string; content: string };
  auth: AuthConfig;
}