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

    // [New] Recognize curl commands whose Content-Type is multipart/form-data (with boundary) and whose body is raw multipart text
    // (typical source: Chrome DevTools "Copy as cURL (bash)" copies the entire raw multipart body as --data-raw $'---boundary\r\nContent-Disposition:...'),
    // and convert it to the standard form-data entry format consistent with -F / --form-string.
    // If parsing fails (e.g. the body has no delimiter), keep the body as-is and don't affect existing paths.
    this.convertRawMultipartToFormData(result);

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
    // Parse form field: name=value or name=@filename
    const equalIndex = content.indexOf('=');
    if (equalIndex > 0) {
      const name = content.slice(0, equalIndex);
      let value = content.slice(equalIndex + 1);

      // Handle file upload (@filename, --form-string does not recognize @)
      const isFile = !isString && value.startsWith('@');
      if (isFile) {
        value = value.slice(1); // Remove @ prefix
        // Strip one layer of paired wrapping double quotes from the path (e.g. @"/path/file.xlsx", shell quotes are not part of the path)
        value = this.stripPairedQuotes(value);
        // [Bug1 fix] Strip the ;type= parameter segment first, then take the basename: in the curl -F file entry syntax name=@path;type=mime,
        // the path comes before the first ;type=; slashes inside the MIME value (e.g. image/png) belong to the MIME value itself and must not be
        // treated as path separators, which would truncate the file name. Also extract that MIME and keep it in the serialized output, only
        // falling back to application/octet-stream when it is missing
        const typeMarkerIndex = value.indexOf(';type=');
        const path = typeMarkerIndex >= 0 ? value.slice(0, typeMarkerIndex) : value;
        const mimeType =
          typeMarkerIndex >= 0
            ? value.slice(typeMarkerIndex + ';type='.length).split(';')[0]
            : '';
        // Extract the file name (basename), compatible with both / and \ path separators
        let fileName = path.split(/[/\\]/).pop() || '';
        // Semicolons in the file name would break the downstream file entry format (name=@file;type=...), replace with _
        fileName = fileName.replace(/;/g, '_');
        // Serialize as the downstream FormdataEditor file entry format: name=@filename;type=MIME;base64,
        // (empty base64 means waiting for the user to select a file in the UI to fill in)
        value = `@${fileName};type=${mimeType || 'application/octet-stream'};base64,`;
      } else {
        // Text field: --form and --form-string share the same rule; both strip one layer of paired surrounding double quotes (shell quoting is not part of the value)
        value = this.stripPairedQuotes(value);
      }

      // [Design note] curl's official --form-string semantics is literal sending, and the double quotes are part of the value
      // (real curl sends the quotes as-is). Here, to align the "three ends" (UI display, background actual send, curl export),
      // we deliberately strip one layer of paired surrounding double quotes and uniformly serialize as name=value,
      // aligned with the downstream FormdataEditor parsing and the background send format.
      // A note for future readers: if you need to reproduce curl's literal semantics exactly, this handling deviates from curl;
      // that is an intentional trade-off, not a bug - please do not change it back.

      // Build multipart content (simplified - Postman handles this more sophisticatedly)
      // --form and --form-string are both serialized as name=value without quotes, aligned with the downstream FormdataEditor parsing and the background send format
      const formContent = result.body?.content || '';
      const newField = `${name}=${value}`;
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
   * Strip one layer of paired wrapping double quotes from a value
   * Only strips when the value starts with " and ends with " and has length >= 2, quotes inside the value are not affected
   * @param value Original value
   * @returns The value with one layer of wrapping double quotes removed
   */
  private stripPairedQuotes(value: string): string {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    return value;
  }

  /**
   * [New] Convert a request with a raw multipart body + multipart/form-data Content-Type header into the standard form-data entry format
   * Note: even without this step, detectBodyType would set body.type to 'form-data' because the Content-Type is multipart/form-data,
   * but content would still be the raw boundary/Content-Disposition text, which FormdataEditor would parse as one key=value per line, producing garbage rows.
   * This adds a semantic layer: only when content can actually be split by the boundary into valid form-data fields is it replaced with the standard entry format;
   * on parse failure (no delimiter found, no name, etc.) it returns null and leaves the body untouched, not affecting existing paths like -F / --form-string / urlencoded.
   */
  private convertRawMultipartToFormData(result: CurlParseResult): void {
    // The parsed type must be form-data (i.e. a multipart/form-data Content-Type is declared) and a body must already exist
    if (result.body?.type !== 'form-data' || !result.body.content) return;

    const contentTypeHeader = result.headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    );
    if (!contentTypeHeader) return;

    const boundary = this.extractBoundary(contentTypeHeader.value);
    if (!boundary) return;

    const parsed = this.parseMultipartBody(result.body.content, boundary);
    if (parsed) {
      // Replace with the standard format; keep the Content-Type header untouched (the send side automatically strips the manual Content-Type for form-data, consistent with -F import behavior)
      result.body = { type: 'form-data', content: parsed };
    }
  }

  /**
   * [New] Extract the boundary parameter value from a Content-Type header value
   * Supports both boundary=abc and boundary="abc" forms; the value is truncated at a ; or the end of the line; case-insensitive
   * @param contentTypeValue Content-Type header value, e.g. multipart/form-data; boundary="----WebKitFormBoundaryXXX"
   * @returns The boundary value, or an empty string if not found
   */
  private extractBoundary(contentTypeValue: string): string {
    const m = contentTypeValue.match(/boundary=(?:"([^"]*)"|([^;]*))/i);
    if (!m) return '';
    return (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : '').trim();
  }

  /**
   * [New] Parse a raw multipart body into a standard form-data entry string (one per line: key=value or key=@filename;type=MIME;base64,)
   * Algorithm:
   * 1. Split on the --boundary delimiter; skip the preamble (before the first delimiter) and the closing --boundary-- section
   * 2. Within each section, separate the header block from the body with a blank line (\r\n\r\n or \n\n)
   * 3. Parse the header lines to identify Content-Disposition (must contain form-data and name=..., optionally filename=...) and Content-Type
   * 4. With filename -> file entry name=@filename;type=ContentType||'application/octet-stream';base64,
   *    (base64 data is left empty for the UI to re-select a file; file binary content is not preserved, so garbage/escaping is irrelevant)
   *    Without filename -> text entry name=bodyContent (the body is a literal, no quote handling)
   * Handles both \r\n and \n line endings; on parse failure (no delimiter, no valid field name, etc.) returns null and keeps the original raw body
   * @param body Raw multipart body
   * @param boundary Boundary value extracted from Content-Type (without the leading --)
   * @returns Standard form-data entry string, or null on failure
   */
  private parseMultipartBody(body: string, boundary: string): string | null {
    if (!boundary) return null;
    const delimiter = '--' + boundary;
    // No delimiter found, so this is not raw multipart; hand it to the existing logic
    if (!body.includes(delimiter)) return null;

    const sections = body.split(delimiter);
    const entries: string[] = [];

    for (let i = 1; i < sections.length; i++) {
      let section = sections[i];

      // After splitting, the remaining section of the closing delimiter --boundary-- starts with --; skip it along with any following epilogue
      if (section.startsWith('--')) continue;

      // Strip the line ending that comes with the delimiter (the \r\n after --boundary)
      section = section.replace(/^\r?\n/, '');
      if (!section.trim()) continue;

      // Separate the header block from the body with a blank line (handles both \r\n\r\n and \n\n)
      let headBlock = section;
      let bodyPart = '';
      const sepIdx = this.findHeaderBodySeparator(section);
      if (sepIdx >= 0) {
        headBlock = section.slice(0, sepIdx);
        const sepLen = section.startsWith('\r\n\r\n', sepIdx) ? 4 : 2;
        bodyPart = section.slice(sepIdx + sepLen);
        // Strip the \r\n at the end of the body, just before the next delimiter (in MIME, that newline belongs to the delimiter line ending)
        bodyPart = bodyPart.replace(/\r?\n$/, '');
      }

      // Parse the header block of this section line by line
      let isFormData = false;
      let name = '';
      let filename: string | undefined;
      let contentType = '';
      for (const line of headBlock.split(/\r?\n/)) {
        const colonIdx = line.indexOf(':');
        if (colonIdx <= 0) continue;
        const headerKey = line.slice(0, colonIdx).trim().toLowerCase();
        const headerValue = line.slice(colonIdx + 1).trim();
        if (headerKey === 'content-disposition') {
          if (!/form-data/i.test(headerValue)) continue;
          isFormData = true;
          const n = this.extractMultipartParam(headerValue, 'name');
          if (n) name = n;
          const fn = this.extractMultipartParam(headerValue, 'filename');
          if (fn) filename = fn;
        } else if (headerKey === 'content-type') {
          contentType = headerValue;
        }
      }

      // Not a form-data field or no field name: treat as unparseable and skip this section
      if (!isFormData || !name) continue;

      if (filename !== undefined) {
        // File entry: like -F import, take the basename (handles both / and \), and replace semicolons with _ to avoid breaking the downstream entry format;
        // base64 is left empty for the UI to re-select a file
        const baseName = filename.split(/[/\\]/).pop() || filename;
        const safeName = baseName.replace(/;/g, '_');
        entries.push(`${name}=@${safeName};type=${contentType || 'application/octet-stream'};base64,`);
      } else {
        // Text entry: the body is the value (a literal, no quote handling)
        entries.push(`${name}=${bodyPart}`);
      }
    }

    if (entries.length === 0) return null;
    return entries.join('\n');
  }

  /**
   * [New] Extract the value of a given attribute (e.g. name / filename) from a Content-Disposition header value
   * Handles quoted and unquoted forms; attribute names are case-insensitive; whitespace around the = sign is allowed
   * @param headerValue Content-Disposition header value, e.g. form-data; name="file"; filename="a.xlsx"
   * @param attr Attribute name (name / filename)
   * @returns The attribute value (trimmed, with one layer of surrounding quotes removed), or an empty string if not found
   */
  private extractMultipartParam(headerValue: string, attr: string): string {
    const re = new RegExp('(?:^|;)\\s*' + attr + '\\s*=\\s*("([^"]*)"|([^;]*))', 'i');
    const m = headerValue.match(re);
    if (!m) return '';
    const val = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : '';
    return this.stripPairedQuotes(val.trim());
  }

  /**
   * [New] Find the blank-line separator position between the header block and the body of a multipart section (\r\n\r\n or \n\n), or -1 if not found
   */
  private findHeaderBodySeparator(section: string): number {
    const crlfIdx = section.indexOf('\r\n\r\n');
    if (crlfIdx >= 0) return crlfIdx;
    return section.indexOf('\n\n');
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

      // [Bug2 fix] Shell single-quote "close-escape-reopen" pattern: ...'\''... (curlGenerator.quoteArg emits
      // close-quote + \' + reopen-quote for values containing apostrophes). When in single-quote state we read a '
      // followed by \', append the literal apostrophe to current and skip the escape along with the following reopen
      // quote (i += 2) rather than treating it as the end of the quote; otherwise handle it as a normal end quote
      // (e.g. it'\''s should tokenize as it's, not be wrongly split into it\s)
      if (
        inQuote &&
        char === "'" &&
        quoteChar === "'" &&
        !isAnsiCQuoting &&
        cmd[i + 1] === '\\' &&
        cmd[i + 2] === "'"
      ) {
        current += "'";
        i += 2;
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