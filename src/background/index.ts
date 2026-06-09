/**
 * Background Service Worker
 * Handles cross-origin HTTP requests and message passing
 */

import { ExecuteRequestMessage, HttpResponse, AuthConfig } from '@/types';

// Open new tab when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/popup/popup.html'),
  });
});

/**
 * Listen for messages from popup
 */
chrome.runtime.onMessage.addListener(
  (message: ExecuteRequestMessage, _sender, sendResponse) => {
    if (message.type === 'executeRequest') {
      // Handle request asynchronously
      executeRequest(message.request)
        .then((response) => {
          sendResponse({ success: true, data: response });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate async response
      return true;
    }
  }
);

/**
 * Generate request headers from auth configuration
 */
function buildAuthHeaders(auth: AuthConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  if (!auth || auth.type === 'no-auth') {
    return headers;
  }

  switch (auth.type) {
    case 'api-key':
      if (auth.apiKey?.key && auth.apiKey?.value) {
        // API Key added to header
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
 * Modify URL based on auth configuration (add query parameters)
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
 * Smart add default request headers
 */
function buildHeaders(request: HttpRequestInternal, hasFormDataBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};

  // 1. Add user-defined enabled headers first (user takes priority)
  request.headers
    .filter((h) => h.enabled && h.key.trim())
    .forEach((h) => {
      const key = h.key.toLowerCase();
      headers[key] = h.value;
    });

  // 2. Add auth headers (do NOT overwrite user-defined headers)
  const authHeaders = buildAuthHeaders(request.auth);
  for (const [key, value] of Object.entries(authHeaders)) {
    if (!headers[key]) {
      headers[key] = value;
    }
  }

  // 3. Auto-set default headers (when user hasn't set them)

  // Content-Type: auto-set based on body type and rawType
  if (!hasFormDataBody && request.body.type !== 'none' && request.body.content.trim()) {
    const contentTypeKey = 'content-type';
    if (!headers[contentTypeKey]) {
      switch (request.body.type) {
        case 'x-www-form-urlencoded':
          headers[contentTypeKey] = 'application/x-www-form-urlencoded';
          break;
        case 'raw':
          // Set Content-Type based on raw subtype
          switch (request.body.rawType) {
            case 'json':
              headers[contentTypeKey] = 'application/json';
              break;
            case 'xml':
              headers[contentTypeKey] = 'application/xml';
              break;
            case 'html':
              headers[contentTypeKey] = 'text/html';
              break;
            case 'javascript':
              headers[contentTypeKey] = 'application/javascript';
              break;
            default:
              headers[contentTypeKey] = 'text/plain';
              break;
          }
          break;
      }
    }
  }

  // Accept: default to accept JSON
  const acceptKey = 'accept';
  if (!headers[acceptKey]) {
    headers[acceptKey] = 'application/json, text/plain, */*';
  }

  // User-Agent: add identifier
  const userAgentKey = 'user-agent';
  if (!headers[userAgentKey]) {
    headers[userAgentKey] = 'SimpleRequest/1.0.0';
  }

  return headers;
}

/**
 * Parse form-data content to FormData object
 * Supports file entries: key=@filename;type=mimetype;base64,data
 */
function parseFormDataContent(content: string): FormData {
  const formData = new FormData();
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    // Check for file entry: key=@filename;type=mimetype;base64,data
    const eqIdx = line.indexOf('=@');
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const filePart = line.slice(eqIdx + 2);
      const semicolonIdx = filePart.indexOf(';');
      const fileName = semicolonIdx > 0 ? filePart.slice(0, semicolonIdx) : filePart;

      let mimeType = 'application/octet-stream';
      let base64Data = '';

      if (semicolonIdx > 0) {
        const rest = filePart.slice(semicolonIdx + 1);
        const typeMatch = rest.match(/^type=([^;]+);/);
        if (typeMatch) mimeType = typeMatch[1];
        const base64Match = rest.match(/base64,(.+)$/);
        if (base64Match) base64Data = base64Match[1];
      }

      if (base64Data) {
        // Decode base64 to binary and create Blob
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        formData.append(key, blob, fileName);
      } else {
        // Fallback: no data, send filename as text
        formData.append(key, fileName);
      }
      continue;
    }

    // Regular text entry: key=value
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key.trim()) {
      formData.append(key.trim(), value || '');
    }
  }

  return formData;
}

/**
 * Parse x-www-form-urlencoded content to URLSearchParams
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
 * Execute HTTP request
 */
async function executeRequest(request: HttpRequestInternal): Promise<HttpResponse> {
  const startTime = Date.now();

  try {
    // Apply auth to URL (API Key query parameter)
    let url = applyAuthToUrl(request.url, request.auth);

    // Build request body
    let body: string | FormData | URLSearchParams | undefined = undefined;
    let hasFormDataBody = false;

    // GET/HEAD requests must not have a body (fetch API restriction)
    const isBodyAllowed = !['GET', 'HEAD'].includes(request.method.toUpperCase());

    if (isBodyAllowed && request.body.type !== 'none' && request.body.content.trim()) {
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

    // Build request headers (including auth)
    const headers = buildHeaders(request, hasFormDataBody);

    // Send request
    const response = await fetch(url, {
      method: request.method,
      headers,
      body: body,
    });

    const endTime = Date.now();

    // Parse response
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
    throw new Error(error.message || 'Request failed');
  }
}

/**
 * HTTP request type (internal use in background)
 */
interface HttpRequestInternal {
  method: string;
  url: string;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  body: { type: string; content: string; rawType?: string };
  auth: AuthConfig;
}