/**
 * Background Service Worker
 * 处理跨域HTTP请求和消息传递
 */

import { ExecuteRequestMessage, HttpResponse } from '@/types';

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
 * 智能添加默认请求头
 * @param request 请求配置
 * @param hasFormDataBody 是否有 FormData body (不设置 Content-Type)
 * @returns 完整的请求头
 */
function buildHeaders(request: HttpRequestInternal, hasFormDataBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};

  // 1. 添加用户自定义的启用请求头
  request.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      headers[h.key.toLowerCase()] = h.value;
    });

  // 2. 智能添加默认请求头（用户未设置时）

  // Content-Type: 根据body类型自动设置
  // 注意：form-data 不手动设置 Content-Type，让浏览器自动处理 boundary
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
 * 格式: key=value (每行一个)
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
 * 格式: key=value (每行一个)
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
 * @param request HTTP请求配置
 * @returns HTTP响应
 */
async function executeRequest(request: HttpRequestInternal): Promise<HttpResponse> {
  const startTime = Date.now();

  try {
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

    // 构建请求头（智能添加默认头）
    const headers = buildHeaders(request, hasFormDataBody);

    // 发起请求
    const response = await fetch(request.url, {
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
}