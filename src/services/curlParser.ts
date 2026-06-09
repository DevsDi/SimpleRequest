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
}

/**
 * curl command parser
 * Converts curl command to request configuration
 */
class CurlParser {
  /**
   * Parse curl command
   * @param command curl command string
   * @returns Request configuration
   */
  parse(command: string): HttpRequest {
    const result = this.parseCurl(command);

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: result.url.split('/').pop() || 'curl import',
      method: result.method,
      url: result.url,
      headers: result.headers,
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
    };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      switch (token) {
        case '-X':
        case '--request':
          result.method = (tokens[++i] || 'GET') as HttpMethod;
          break;

        case '-H':
        case '--header':
          const headerStr = tokens[++i] || '';
          const colonIndex = headerStr.indexOf(':');
          if (colonIndex > 0) {
            result.headers.push({
              key: headerStr.slice(0, colonIndex).trim(),
              value: headerStr.slice(colonIndex + 1).trim(),
              enabled: true,
            });
          }
          break;

        case '-d':
        case '--data':
        case '--data-raw':
        case '--data-binary':
          const bodyContent = tokens[++i] || '';
          const bodyType = this.detectBodyType(result.headers, bodyContent);
          result.body = {
            type: bodyType,
            content: bodyContent,
            rawType: bodyType === 'raw' ? this.detectRawType(result.headers, bodyContent) : undefined,
          };
          // If no method specified, default to POST when body is present
          if (result.method === 'GET') {
            result.method = 'POST';
          }
          break;

        case '-u':
        case '--user':
          const authStr = tokens[++i] || '';
          // Use auth system instead of raw header
          const colonIdx = authStr.indexOf(':');
          result.auth = {
            type: 'basic-auth',
            basicAuth: {
              username: colonIdx > 0 ? authStr.slice(0, colonIdx) : authStr,
              password: colonIdx > 0 ? authStr.slice(colonIdx + 1) : '',
            },
          };
          break;

        default:
          // URL recognition
          if (token.startsWith('http://') || token.startsWith('https://')) {
            result.url = token;
          } else if (!result.url && token.includes('.') && !token.startsWith('-') && !token.startsWith('curl')) {
            // Recognize URLs without protocol (e.g. example.com/api)
            result.url = 'https://' + token;
          } else if (token.startsWith('curl')) {
            // Ignore curl command itself
          }
      }
    }

    return result;
  }

  /**
   * Clean command
   * Only remove curl line continuation backslashes, preserve escape characters in JSON content
   */
  private normalizeCommand(cmd: string): string {
    // Remove backslash+newline (curl line continuation)
    // Remove trailing backslashes
    return cmd.replace(/\\\n/g, ' ').replace(/\\(\s*)$/gm, '').trim();
  }

  /**
   * Tokenize (handle quotes, including ANSI-C quoting $'...' format)
   */
  private tokenize(cmd: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    let isAnsiCQuoting = false; // $'...' format

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

      if (!inQuote && (char === '"' || char === "'")) {
        inQuote = true;
        quoteChar = char;
        isAnsiCQuoting = false;
        continue;
      }

      if (inQuote && char === '\\' && isAnsiCQuoting) {
        // ANSI-C quoting escape handling
        const nextChar = cmd[i + 1];
        if (nextChar === "'") {
          // \' -> '
          current += "'";
          i++;
          continue;
        } else if (nextChar === 'u' && cmd.slice(i + 2, i + 6).match(/[0-9a-fA-F]{4}/)) {
          // \uXXXX -> Unicode character
          const hex = cmd.slice(i + 2, i + 6);
          current += String.fromCharCode(parseInt(hex, 16));
          i += 5; // Skip \uXXXX
          continue;
        } else if (nextChar === 'n') {
          // \n -> newline
          current += '\n';
          i++;
          continue;
        } else if (nextChar === 't') {
          // \t -> tab
          current += '\t';
          i++;
          continue;
        } else if (nextChar === 'r') {
          // \r -> carriage return
          current += '\r';
          i++;
          continue;
        } else if (nextChar === '\\') {
          // \\ -> \
          current += '\\';
          i++;
          continue;
        }
        // Other cases preserve backslash
        current += char;
        continue;
      }

      if (inQuote && char === quoteChar && !isAnsiCQuoting) {
        // Normal quote end (non ANSI-C quoting)
        inQuote = false;
        quoteChar = '';
        continue;
      }

      // In ANSI-C quoting, single quote must be escaped, so direct single quote means end
      if (inQuote && isAnsiCQuoting && char === "'") {
        inQuote = false;
        quoteChar = '';
        isAnsiCQuoting = false;
        continue;
      }

      if (!inQuote && char === ' ') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

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
      // JSON content falls under 'raw' type (with JSON subtype in BodyEditor)
      try {
        JSON.parse(body);
        return 'raw';
      } catch {
        return 'raw';
      }
    }

    const ct = contentType.value.toLowerCase();
    // JSON is a subtype of 'raw' in the BodyEditor UI
    if (ct.includes('application/json')) return 'raw';
    if (ct.includes('multipart/form-data')) return 'form-data';
    if (ct.includes('application/x-www-form-urlencoded')) {
      return 'x-www-form-urlencoded';
    }

    return 'raw';
  }

  /** Detect raw subtype from Content-Type header or content */
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
    }

    // Fallback: try to detect from content
    if (body.trim()) {
      try {
        JSON.parse(body);
        return 'json';
      } catch {}
    }

    return undefined;
  }
}

export const curlParser = new CurlParser();