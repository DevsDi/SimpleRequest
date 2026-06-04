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
 * @returns 完整的请求头
 */
function buildHeaders(request: HttpRequestInternal): Record<string, string> {
  const headers: Record<string, string> = {};

  // 1. 添加用户自定义的启用请求头
  request.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      headers[h.key.toLowerCase()] = h.value;
    });

  // 2. 智能添加默认请求头（用户未设置时）

  // Content-Type: 根据body类型自动设置
  if (request.body.type !== 'none' && request.body.content.trim()) {
    const contentTypeKey = 'content-type';
    if (!headers[contentTypeKey]) {
      switch (request.body.type) {
        case 'json':
          headers[contentTypeKey] = 'application/json';
          break;
        case 'form-data':
          headers[contentTypeKey] = 'multipart/form-data';
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
 * 执行HTTP请求
 * @param request HTTP请求配置
 * @returns HTTP响应
 */
async function executeRequest(request: HttpRequestInternal): Promise<HttpResponse> {
  const startTime = Date.now();

  try {
    // 构建请求头（智能添加默认头）
    const headers = buildHeaders(request);

    // 构建请求体
    let body: string | undefined = undefined;
    if (request.body.type !== 'none' && request.body.content.trim()) {
      body = request.body.content;
    }

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