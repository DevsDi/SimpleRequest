import { HttpMethod, Header, RequestBody, HttpRequest, AuthConfig, RawContentType } from '@/types';

/**
 * curl command parse result
 */
interface CurlParseResult {
  method: HttpMethod;
  url: string;
  headers: Header[];
  body: RequestBody | null;
  auth?: AuthConfig;
  /** Whether to follow redirects */
  followRedirects: boolean;
  /** Maximum number of redirects to follow */
  maxRedirects?: number;
  /** Compressed response requested */
  compressed: boolean;
  /** Insecure SSL (skip certificate verification) */
  insecure: boolean;
  /** Timeout in seconds */
  timeout?: number;
  /** Connect timeout in seconds */
  connectTimeout?: number;
  /** User-Agent header */
  userAgent?: string;
  /** Referer header */
  referer?: string;
  /** Cookie string */
  cookie?: string;
  /** Proxy settings */
  proxy?: string;
}

/**
 * curl command parser
 * Converts curl command to request configuration
 * Supports comprehensive curl options similar to Postman's import feature
 */
class CurlParser {
  /**
   * Parse curl command
   * @param command curl command string
   * @returns Request configuration
   */
  parse(command: string): HttpRequest {
    const result = this.parseCurl(command);

    // Apply derived headers from parsed options
    const derivedHeaders: Header[] = [];

    // User-Agent
    if (result.userAgent) {
      derivedHeaders.push({
        key: 'User-Agent',
        value: result.userAgent,
        enabled: true,
      });
    }

    // Referer
    if (result.referer) {
      derivedHeaders.push({
        key: 'Referer',
        value: result.referer,
        enabled: true,
      });
    }

    // Cookie
    if (result.cookie) {
      derivedHeaders.push({
        key: 'Cookie',
        value: result.cookie,
        enabled: true,
      });
    }

    // Accept-Encoding (for compressed)
    if (result.compressed) {
      const existingAcceptEncoding = result.headers.find(
        (h) => h.key.toLowerCase() === 'accept-encoding'
      );
      if (!existingAcceptEncoding) {
        derivedHeaders.push({
          key: 'Accept-Encoding',
          value: 'gzip, deflate, br',
          enabled: true,
        });
      }
    }

    // Merge headers (user-provided headers take precedence)
    const finalHeaders = [...derivedHeaders, ...result.headers];

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: result.url.split('/').pop() || 'curl import',
      method: result.method,
      url: result.url,
      headers: finalHeaders,
      body: result.body || { type: 'none', content: '' },
      auth: result.auth || { type: 'no-auth' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Internal parse method
   */
  private parseCurl(command: string): CurlParseResult {
    // Clean command (remove newlines and extra spaces)
    const cleaned = this.normalizeCommand(command);

    // Tokenize (handle quotes)
    const tokens = this.tokenize(cleaned);

    // Parse arguments
    const result: CurlParseResult = {
      method: 'GET',
      url: '',
      headers: [],
      body: null,
      followRedirects: true, // Default to following redirects
      compressed: false,
      insecure: false,
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const nextToken = tokens[i + 1];

      // Skip empty tokens
      if (!token) continue;

      // Handle options with values (need next token)
      if (nextToken) {
        // Method
        if (this.matchOption(token, 'X', 'request')) {
          result.method = this.parseMethod(nextToken);
          i++;
          continue;
        }

        // Headers
        if (this.matchOption(token, 'H', 'header')) {
          this.parseHeader(nextToken, result.headers);
          i++;
          continue;
        }

        // Body data options
        if (
          this.matchOption(token, 'd', 'data') ||
          this.matchOption(token, '', 'data-raw') ||
          this.matchOption(token, '', 'data-binary') ||
          this.matchOption(token, '', 'data-ascii') ||
          this.matchOption(token, '', 'json')
        ) {
          this.parseBody(nextToken, result);
          i++;
          continue;
        }

        // URL-encoded data
        if (this.matchOption(token, '', 'data-urlencode')) {
          this.parseUrlEncodedBody(nextToken, result);
          i++;
          continue;
        }

        // Form data (multipart)
        if (this.matchOption(token, 'F', 'form') || this.matchOption(token, '', 'form-string')) {
          this.parseFormData(nextToken, result, token === '--form-string');
          i++;
          continue;
        }

        // Basic auth
        if (this.matchOption(token, 'u', 'user')) {
          this.parseBasicAuth(nextToken, result);
          i++;
          continue;
        }

        // Bearer token (custom header pattern)
        if (token.toLowerCase() === '--bearer' || token === '-bearer') {
          result.auth = {
            type: 'bearer-token',
            bearerToken: {
              token: nextToken,
            },
          };
          // Also remove Authorization header if already set
          const authHeaderIndex = result.headers.findIndex(
            (h) => h.key.toLowerCase() === 'authorization'
          );
          if (authHeaderIndex >= 0) {
            result.headers.splice(authHeaderIndex, 1);
          }
          i++;
          continue;
        }

        // User-Agent
        if (this.matchOption(token, 'A', 'user-agent')) {
          result.userAgent = nextToken;
          i++;
          continue;
        }

        // Referer
        if (this.matchOption(token, 'e', 'referer')) {
          result.referer = nextToken;
          i++;
          continue;
        }

        // Cookie
        if (this.matchOption(token, 'b', 'cookie')) {
          result.cookie = nextToken;
          i++;
          continue;
        }

        // Proxy
        if (this.matchOption(token, 'x', 'proxy')) {
          result.proxy = nextToken;
          i++;
          continue;
        }

        // Max time / timeout
        if (this.matchOption(token, 'm', 'max-time')) {
          result.timeout = parseInt(nextToken, 10);
          i++;
          continue;
        }

        // Connect timeout
        if (this.matchOption(token, '', 'connect-timeout')) {
          result.connectTimeout = parseFloat(nextToken);
          i++;
          continue;
        }

        // Max redirects
        if (this.matchOption(token, '', 'max-redirs')) {
          result.maxRedirects = parseInt(nextToken, 10);
          i++;
          continue;
        }

        // URL
        if (this.matchOption(token, '', 'url')) {
          result.url = nextToken;
          i++;
          continue;
        }
      }

      // Boolean flags (no value needed)
      if (this.matchOption(token, 'L', 'location') || this.matchOption(token, '', 'follow')) {
        result.followRedirects = true;
        continue;
      }

      // No follow redirects
      if (token === '--no-location' || token === '--no-follow') {
        result.followRedirects = false;
        continue;
      }

      // Compressed
      if (this.matchOption(token, '', 'compressed')) {
        result.compressed = true;
        continue;
      }

      // Insecure (skip SSL verification)
      if (this.matchOption(token, 'k', 'insecure')) {
        result.insecure = true;
        continue;
      }

      // HEAD method
      if (this.matchOption(token, 'I', 'head')) {
        result.method = 'HEAD';
        continue;
      }

      // GET method (force GET even with data)
      if (this.matchOption(token, 'G', 'get')) {
        result.method = 'GET';
        // Move body data to URL query params if present
        if (result.body && result.body.content) {
          const separator = result.url.includes('?') ? '&' : '?';
          result.url = result.url + separator + result.body.content;
          result.body = null;
        }
        continue;
      }

      // Default URL detection
      if (token.startsWith('http://') || token.startsWith('https://')) {
        result.url = token;
      } else if (
        !result.url &&
        token.includes('.') &&
        !token.startsWith('-') &&
        !token.startsWith('curl')
      ) {
        // Recognize URLs without protocol (e.g. example.com/api)
        result.url = 'https://' + token;
      }
    }

    return result;
  }

  /**
   * Match curl option (handles short and long forms)
   * @param token Current token
   * @param shortForm Short option letter (e.g. 'H' for -H)
   * @param longForm Long option name (e.g. 'header' for --header)
   * @returns Whether token matches this option
   */
  private matchOption(token: string, shortForm: string, longForm: string): boolean {
    const normalizedToken = token.toLowerCase();
    if (shortForm && normalizedToken === `-${shortForm.toLowerCase()}`) {
      return true;
    }
    if (longForm && (normalizedToken === `--${longForm}` || normalizedToken === `--${longForm.toLowerCase()}`)) {
      return true;
    }
    return false;
  }

  /**
   * Parse HTTP method
   */
  private parseMethod(methodStr: string): HttpMethod {
    const normalized = methodStr.toUpperCase();
    const validMethods: HttpMethod[] = [
      'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE',
    ];
    if (validMethods.includes(normalized as HttpMethod)) {
      return normalized as HttpMethod;
    }
    return 'GET';
  }

  /**
   * Parse header string
   */
  private parseHeader(headerStr: string, headers: Header[]): void {
    // Handle "key: value" format
    const colonIndex = headerStr.indexOf(':');
    if (colonIndex > 0) {
      const key = headerStr.slice(0, colonIndex).trim();
      const value = headerStr.slice(colonIndex + 1).trim();
      // Check for duplicate headers
      const existingIndex = headers.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
      if (existingIndex >= 0) {
        headers[existingIndex].value = value;
      } else {
        headers.push({ key, value, enabled: true });
      }
    }
    // Handle "key;" format (empty header, for removal)
    else if (headerStr.endsWith(';')) {
      const key = headerStr.slice(0, -1).trim();
      // Mark as disabled or remove existing
      const existingIndex = headers.findIndex((h) => h.key.toLowerCase() === key.toLowerCase());
      if (existingIndex >= 0) {
        headers[existingIndex].enabled = false;
      }
    }
  }

  /**
   * Parse body content
   */
  private parseBody(content: string, result: CurlParseResult): void {
    const bodyType = this.detectBodyType(result.headers, content);
    result.body = {
      type: bodyType,
      content: content,
      rawType: bodyType === 'raw' ? this.detectRawType(result.headers, content) : undefined,
    };
    // Default to POST if body present and method is GET
    if (result.method === 'GET') {
      result.method = 'POST';
    }
  }

  /**
   * Parse URL-encoded body data
   */
  private parseUrlEncodedBody(content: string, result: CurlParseResult): void {
    // Set Content-Type if not already set
    const contentTypeHeader = result.headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    );
    if (!contentTypeHeader) {
      result.headers.push({
        key: 'Content-Type',
        value: 'application/x-www-form-urlencoded',
        enabled: true,
      });
    }

    // Append to existing body or create new
    if (result.body && result.body.content) {
      result.body.content += '&' + content;
    } else {
      result.body = {
        type: 'x-www-form-urlencoded',
        content: content,
      };
    }

    if (result.method === 'GET') {
      result.method = 'POST';
    }
  }

  /**
   * Parse multipart form data
   */
  private parseFormData(content: string, result: CurlParseResult, isString: boolean): void {
    // Set Content-Type if not already set
    const contentTypeHeader = result.headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    );
    if (!contentTypeHeader) {
      result.headers.push({
        key: 'Content-Type',
        value: 'multipart/form-data',
        enabled: true,
      });
    }

    // Parse form field: name=value or name=@filename
    const equalIndex = content.indexOf('=');
    if (equalIndex > 0) {
      const name = content.slice(0, equalIndex);
      let value = content.slice(equalIndex + 1);

      // Handle file upload (@filename)
      const isFile = !isString && value.startsWith('@');
      if (isFile) {
        value = value.slice(1); // Remove @ prefix
      }

      // Build multipart content (simplified - Postman handles this more sophisticatedly)
      const formContent = result.body?.content || '';
      const newField = isFile ? `${name}=@"${value}"` : `${name}="${value}"`;
      result.body = {
        type: 'form-data',
        content: formContent ? formContent + '\n' + newField : newField,
      };
    }

    if (result.method === 'GET') {
      result.method = 'POST';
    }
  }

  /**
   * Parse Basic authentication
   */
  private parseBasicAuth(authStr: string, result: CurlParseResult): void {
    const colonIdx = authStr.indexOf(':');
    result.auth = {
      type: 'basic-auth',
      basicAuth: {
        username: colonIdx > 0 ? authStr.slice(0, colonIdx) : authStr,
        password: colonIdx > 0 ? authStr.slice(colonIdx + 1) : '',
      },
    };
    // Remove Authorization header if already set (curl -u overrides)
    const authHeaderIndex = result.headers.findIndex(
      (h) => h.key.toLowerCase() === 'authorization'
    );
    if (authHeaderIndex >= 0) {
      result.headers.splice(authHeaderIndex, 1);
    }
  }

  /**
   * Clean command
   * Remove curl line continuation backslashes, preserve escape characters in content
   */
  private normalizeCommand(cmd: string): string {
    // Remove backslash+newline (curl line continuation)
    return cmd.replace(/\\\n/g, '').replace(/\\\r\n/g, '').trim();
  }

  /**
   * Tokenize (handle quotes, including ANSI-C quoting $'...' format)
   * Supports: single quotes, double quotes, $'...' ANSI-C quoting
   */
  private tokenize(cmd: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    let isAnsiCQuoting = false;

    for (let i = 0; i < cmd.length; i++) {
      const char = cmd[i];

      // Detect ANSI-C quoting: $'...'
      if (!inQuote && char === '$' && cmd[i + 1] === "'") {
        inQuote = true;
        quoteChar = "'";
        isAnsiCQuoting = true;
        i++; // Skip $
        continue;
      }

      // Start quote
      if (!inQuote && (char === '"' || char === "'")) {
        inQuote = true;
        quoteChar = char;
        isAnsiCQuoting = false;
        continue;
      }

      // Handle escape sequences in ANSI-C quoting
      if (inQuote && char === '\\' && isAnsiCQuoting) {
        const nextChar = cmd[i + 1];
        if (nextChar === "'") {
          current += "'";
          i++;
          continue;
        } else if (nextChar === 'n') {
          current += '\n';
          i++;
          continue;
        } else if (nextChar === 't') {
          current += '\t';
          i++;
          continue;
        } else if (nextChar === 'r') {
          current += '\r';
          i++;
          continue;
        } else if (nextChar === '\\') {
          current += '\\';
          i++;
          continue;
        }
        current += char;
        continue;
      }

      // Handle escape in double quotes
      if (inQuote && char === '\\' && quoteChar === '"') {
        const nextChar = cmd[i + 1];
        if (nextChar === '"' || nextChar === '\\' || nextChar === 'n' || nextChar === 't' || nextChar === 'r') {
          if (nextChar === 'n') current += '\n';
          else if (nextChar === 't') current += '\t';
          else if (nextChar === 'r') current += '\r';
          else current += nextChar;
          i++;
          continue;
        }
        // Keep backslash for other cases
        current += char;
        continue;
      }

      // End quote (normal)
      if (inQuote && char === quoteChar && !isAnsiCQuoting) {
        inQuote = false;
        quoteChar = '';
        continue;
      }

      // End quote (ANSI-C - single quote not escaped means end)
      if (inQuote && isAnsiCQuoting && char === "'") {
        inQuote = false;
        quoteChar = '';
        isAnsiCQuoting = false;
        continue;
      }

      // Whitespace separator (when not in quote)
      if (!inQuote && /\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    // Push remaining token
    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * Detect body type based on headers
   */
  private detectBodyType(headers: Header[], body: string): RequestBody['type'] {
    const contentType = headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    );

    if (!contentType) {
      // No Content-Type header, try to detect from content
      try {
        JSON.parse(body);
        return 'raw';
      } catch {
        // Check if it looks like form data
        if (body.includes('=') && !body.includes('{')) {
          return 'x-www-form-urlencoded';
        }
        return 'raw';
      }
    }

    const ct = contentType.value.toLowerCase();
    if (ct.includes('application/json')) return 'raw';
    if (ct.includes('multipart/form-data')) return 'form-data';
    if (ct.includes('application/x-www-form-urlencoded')) {
      return 'x-www-form-urlencoded';
    }

    return 'raw';
  }

  /**
   * Detect raw subtype from Content-Type header or content
   */
  private detectRawType(headers: Header[], body: string): RawContentType | undefined {
    const contentType = headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    );

    if (contentType) {
      const ct = contentType.value.toLowerCase();
      if (ct.includes('application/json')) return 'json';
      if (ct.includes('application/xml') || ct.includes('text/xml')) return 'xml';
      if (ct.includes('text/html')) return 'html';
      if (ct.includes('application/javascript') || ct.includes('text/javascript')) return 'javascript';
      if (ct.includes('text/plain')) return 'text';
    }

    // Fallback: try to detect from content
    if (body.trim()) {
      try {
        JSON.parse(body);
        return 'json';
      } catch {}
    }

    return 'text';
  }
}

export const curlParser = new CurlParser();