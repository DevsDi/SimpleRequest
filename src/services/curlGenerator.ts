import { HttpRequest, AuthConfig } from '@/types';

/**
 * Curl command generator
 * Converts HttpRequest configuration to a curl command string
 */
class CurlGenerator {
  /**
   * Generate curl command from HttpRequest
   * @param request The HTTP request configuration
   * @returns curl command string
   */
  generate(request: HttpRequest): string {
    const parts: string[] = ['curl'];

    // Method (always include, even for GET)
    if (request.method !== 'GET') {
      parts.push(`-X ${request.method}`);
    }

    // URL (with query params if any)
    const url = request.url.trim();
    if (url) {
      parts.push(this.quoteArg(url));
    }

    // Auth
    if (request.auth && request.auth.type !== 'no-auth') {
      this.addAuth(parts, request.auth);
    }

    // Headers
    request.headers
      .filter(h => h.enabled && h.key.trim())
      .forEach(h => {
        parts.push(`-H ${this.quoteArg(`${h.key}: ${h.value}`)}`);
      });

    // Body
    if (request.body && request.body.type !== 'none' && request.body.content.trim()) {
      this.addBody(parts, request.body, request.method);
    }

    return parts.join(' \\\n  ');
  }

  /**
   * Add authentication to curl command
   */
  private addAuth(parts: string[], auth: AuthConfig): void {
    switch (auth.type) {
      case 'basic-auth':
        if (auth.basicAuth?.username || auth.basicAuth?.password) {
          const cred = `${auth.basicAuth.username}:${auth.basicAuth.password}`;
          parts.push(`-u ${this.quoteArg(cred)}`);
        }
        break;

      case 'bearer-token':
        if (auth.bearerToken?.token) {
          parts.push(`-H ${this.quoteArg(`Authorization: Bearer ${auth.bearerToken.token}`)}`);
        }
        break;

      case 'api-key':
        if (auth.apiKey?.key && auth.apiKey?.value) {
          if (auth.apiKey.addTo === 'header') {
            parts.push(`-H ${this.quoteArg(`${auth.apiKey.key}: ${auth.apiKey.value}`)}`);
          } else {
            // Query param - append to URL (not handled here, would need URL modification)
            // For curl, we add as a header since modifying URL is complex
            parts.push(`-H ${this.quoteArg(`${auth.apiKey.key}: ${auth.apiKey.value}`)}`);
          }
        }
        break;

      case 'oauth2':
        if (auth.oauth2?.accessToken) {
          const tokenType = auth.oauth2.tokenType || 'Bearer';
          parts.push(`-H ${this.quoteArg(`Authorization: ${tokenType} ${auth.oauth2.accessToken}`)}`);
        }
        break;

      case 'digest-auth':
        // Digest auth requires multiple requests, not fully supported in simple curl
        // Fall back to -u with note
        parts.push(`# Note: Digest auth not fully supported in simple curl`);
        break;
    }
  }

  /**
   * Add body data to curl command
   */
  private addBody(parts: string[], body: { type: string; content: string; rawType?: string }, method: string): void {
    // Check if method allows body
    const bodyAllowedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (!bodyAllowedMethods.includes(method)) {
      return;
    }

    const content = body.content.trim();
    if (!content) return;

    switch (body.type) {
      case 'raw':
        // Raw content (JSON, text, XML, HTML, JavaScript)
        parts.push(`-d ${this.quoteArg(content)}`);
        break;

      case 'x-www-form-urlencoded':
        // URL-encoded form data
        const encodedData = this.parseUrlencoded(content);
        if (encodedData) {
          parts.push(`-d ${this.quoteArg(encodedData)}`);
        }
        break;

      case 'form-data':
        // Multipart form-data - 按条目导出 -F（-d 的语义是 urlencoded/raw body，无法复现 multipart 请求）
        // 文本条目：-F 'key=value'；文件条目：-F 'key=@/path/to/文件名'（占位路径需手动调整）
        const formDataEntries = this.parseFormData(content);
        formDataEntries.forEach(entry => {
          parts.push(`-F ${this.quoteArg(entry)}`);
        });
        break;
    }
  }

  /**
   * Parse urlencoded body content
   * Input: key=value lines
   * Output: key=value&key2=value2
   */
  private parseUrlencoded(content: string): string {
    const lines = content.split('\n').filter(l => l.trim());
    const pairs: string[] = [];

    lines.forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key?.trim()) {
        const value = valueParts.join('=').trim();
        pairs.push(`${encodeURIComponent(key.trim())}=${encodeURIComponent(value)}`);
      }
    });

    return pairs.join('&');
  }

  /**
   * Parse form-data body content
   * Input: key=value or key=@filename;type=mimetype;base64,data
   * Output: 条目数组（每条对应一个 -F 参数）：文本条目为 key=value，
   *         文件条目为 key=@/path/to/文件名  # FILE（沿用原有占位与注释风格）
   */
  private parseFormData(content: string): string[] {
    const lines = content.split('\n').filter(l => l.trim());
    const pairs: string[] = [];

    lines.forEach(line => {
      const fileMarkerIdx = line.indexOf('=@');
      // 与编辑器/发送端判定保持一致：=@ 之后需含 ;type= 或 ;base64, 才视为文件条目，
      // 否则文本值中偶然含有 =@ 的普通条目会被误导出为文件
      const afterMarker = fileMarkerIdx > 0 ? line.slice(fileMarkerIdx + 2) : '';
      if (fileMarkerIdx > 0 && (afterMarker.includes(';type=') || afterMarker.includes(';base64,'))) {
        // File entry - extract key and filename placeholder
        const key = line.slice(0, fileMarkerIdx).trim();
        const filePart = afterMarker;
        const semicolonIdx = filePart.indexOf(';');
        const fileName = semicolonIdx > 0 ? filePart.slice(0, semicolonIdx) : filePart;
        pairs.push(`${key}=@/path/to/${fileName}  # FILE`);
      } else {
        // Text entry
        const [key, ...valueParts] = line.split('=');
        if (key?.trim()) {
          const value = valueParts.join('=').trim();
          pairs.push(`${key}=${value}`);
        }
      }
    });

    return pairs;
  }

  /**
   * Quote argument for shell
   * Uses single quotes for safety (no variable expansion)
   */
  private quoteArg(arg: string): string {
    // If contains single quote, use double quotes with escaping
    if (arg.includes("'")) {
      const escaped = arg.replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return `'${arg}'`;
  }
}

export const curlGenerator = new CurlGenerator();