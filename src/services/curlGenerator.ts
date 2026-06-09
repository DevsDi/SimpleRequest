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
        // Multipart form-data - note about files
        const formDataNote = this.parseFormData(content);
        if (formDataNote.includes('FILE:')) {
          parts.push(`# Note: File uploads require manual path adjustment`);
        }
        parts.push(`-d ${this.quoteArg(formDataNote)}`);
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
   * Output: key=value or key=@/path/to/file for curl
   */
  private parseFormData(content: string): string {
    const lines = content.split('\n').filter(l => l.trim());
    const pairs: string[] = [];

    lines.forEach(line => {
      const fileMarkerIdx = line.indexOf('=@');
      if (fileMarkerIdx > 0) {
        // File entry - extract key and filename placeholder
        const key = line.slice(0, fileMarkerIdx).trim();
        const filePart = line.slice(fileMarkerIdx + 2);
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

    return pairs.join('&');
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