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

    // 【新增】识别「Content-Type: multipart/form-data（含 boundary）且 body 为原始 multipart 文本」的 curl 命令
    // （典型来源：Chrome DevTools「Copy as cURL (bash)」会用 --data-raw $'---boundary\r\nContent-Disposition:...'
    // 复制整段原始 multipart body），将其转换为与 -F / --form-string 一致的标准 form-data 条目格式。
    // 解析失败（如 body 内无分隔线）则保持原样，不影响既有路径。
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
        // 【Bug1 修复】先剥离 ;type= 参数段再取 basename：curl -F 文件条目语法 name=@path;type=mime 中
        // 路径在第一个 ;type= 之前；MIME 值（如 image/png）内的 / 属于 MIME 值本身，不得被当作路径分隔符截断文件名。
        // 同时提取该 MIME 并保留到序列化输出，仅当缺失时才回落到 application/octet-stream
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
        // Text field: --form 与 --form-string 规则统一，均剥一层成对包裹双引号（shell 引用不属于值本身）
        value = this.stripPairedQuotes(value);
      }

      // 【设计说明】curl 官方 --form-string 的语义是字面量发送，双引号本属于值的一部分（真实 curl 会原样发送引号）。
      // 此处为对齐「三端」（UI 显示、background 实际发送、curl 导出），有意剥除一层成对包裹双引号，
      // 并统一序列化为 name=value，与下游 FormdataEditor 解析及 background 发送端格式对齐。
      // 提示后人：若需精确复现原始 curl 的字面语义，此处理与 curl 存在偏差，这是有意取舍而非 bug，请勿改回。

      // Build multipart content (simplified - Postman handles this more sophisticatedly)
      // --form 与 --form-string 统一不加引号序列化为 name=value，与下游 FormdataEditor 解析及 background 发送端格式对齐
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
   * 【新增】将请求中的「原始 multipart body + multipart/form-data Content-Type 头」转为标准 form-data 条目格式
   * 说明：即便不做这一步，detectBodyType 也会因 Content-Type 为 multipart/form-data 而把 body.type 置为 'form-data'，
   * 但 content 仍是 boundary/Content-Disposition 堆叠的原文，FormdataEditor 会把它当一行一条 key=value 解析成垃圾行。
   * 此处再做一层语义识别：content 确实可按 boundary 切分为有效的 form-data 字段时，才替换为标准条目格式；
   * 解析失败（找不到分隔线、无 name 等）则返回 null，保持原 body 不动，不影响 -F / --form-string / urlencoded 等既有路径。
   */
  private convertRawMultipartToFormData(result: CurlParseResult): void {
    // 解析后类型须为 form-data（即声明了 multipart/form-data Content-Type），且已有 body
    if (result.body?.type !== 'form-data' || !result.body.content) return;

    const contentTypeHeader = result.headers.find(
      (h) => h.key.toLowerCase() === 'content-type'
    );
    if (!contentTypeHeader) return;

    const boundary = this.extractBoundary(contentTypeHeader.value);
    if (!boundary) return;

    const parsed = this.parseMultipartBody(result.body.content, boundary);
    if (parsed) {
      // 替换为标准格式；Content-Type 头保留不动（发送端对 form-data 会自动剥离手动 Content-Type，与 -F 导入行为一致）
      result.body = { type: 'form-data', content: parsed };
    }
  }

  /**
   * 【新增】从 Content-Type 头值中提取 boundary 参数值
   * 支持 boundary=abc 与 boundary="abc" 两种写法，值截断到 ; 或行尾，大小写不敏感
   * @param contentTypeValue Content-Type 头值，如 multipart/form-data; boundary="----WebKitFormBoundaryXXX"
   * @returns boundary 值；取不到返回空字符串
   */
  private extractBoundary(contentTypeValue: string): string {
    const m = contentTypeValue.match(/boundary=(?:"([^"]*)"|([^;]*))/i);
    if (!m) return '';
    return (m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : '').trim();
  }

  /**
   * 【新增】解析原始 multipart body 为标准 form-data 条目字符串（每行一条：key=value 或 key=@filename;type=MIME;base64,）
   * 算法：
   * 1. 按分隔线 --boundary 分割；跳过 preamble（首个分隔线之前）与结尾 --boundary-- 的关闭段
   * 2. 每段用空行（\r\n\r\n 或 \n\n）分隔「头部 与 正文」
   * 3. 逐行解析头部，识别 Content-Disposition（须含 form-data、name=...，可选 filename=...）与 Content-Type
   * 4. 有 filename → 文件条目 name=@filename;type=ContentType||'application/octet-stream';base64,
   *    （base64 数据留空等待 UI 重新选择文件；文件二进制内容不保留，乱码/转义无碍）
   *    无 filename → 文本条目 name=bodyContent（正文为字面量，不做引号处理）
   * 兼容 \r\n 与 \n 换行；解析失败（无分隔线、无合法字段名等）返回 null，维持原 raw body 不变
   * @param body 原始 multipart 正文
   * @param boundary 从 Content-Type 提取到的 boundary 值（不含前导 --）
   * @returns 标准 form-data 条目字符串；失败返回 null
   */
  private parseMultipartBody(body: string, boundary: string): string | null {
    if (!boundary) return null;
    const delimiter = '--' + boundary;
    // 找不到分隔线说明不是原始 multipart，交给既有逻辑处理
    if (!body.includes(delimiter)) return null;

    const sections = body.split(delimiter);
    const entries: string[] = [];

    for (let i = 1; i < sections.length; i++) {
      let section = sections[i];

      // 结尾分隔线 --boundary-- 经 split 后剩余段以 -- 开头，连同其后的 epilogue 一并跳过
      if (section.startsWith('--')) continue;

      // 去掉分隔线自带的行尾（--boundary\r\n 的 \r\n）
      section = section.replace(/^\r?\n/, '');
      if (!section.trim()) continue;

      // 以空行分隔头部与正文（兼容 \r\n\r\n 与 \n\n）
      let headBlock = section;
      let bodyPart = '';
      const sepIdx = this.findHeaderBodySeparator(section);
      if (sepIdx >= 0) {
        headBlock = section.slice(0, sepIdx);
        const sepLen = section.startsWith('\r\n\r\n', sepIdx) ? 4 : 2;
        bodyPart = section.slice(sepIdx + sepLen);
        // 去掉正文尾部、下一个分隔线前的 \r\n（MIME 中该换行属于分隔线行尾）
        bodyPart = bodyPart.replace(/\r?\n$/, '');
      }

      // 逐行解析该段头部
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

      // 非 form-data 字段或缺字段名：视为无法解析，跳过该段
      if (!isFormData || !name) continue;

      if (filename !== undefined) {
        // 文件条目：与 -F 导入一致取 basename（兼容 / 与 \），分号替换为 _ 避免破坏下游条目格式；
        // base64 留空等待 UI 重新选文件填充
        const baseName = filename.split(/[/\\]/).pop() || filename;
        const safeName = baseName.replace(/;/g, '_');
        entries.push(`${name}=@${safeName};type=${contentType || 'application/octet-stream'};base64,`);
      } else {
        // 文本条目：正文即值（字面量，不做引号处理）
        entries.push(`${name}=${bodyPart}`);
      }
    }

    if (entries.length === 0) return null;
    return entries.join('\n');
  }

  /**
   * 【新增】从 Content-Disposition 头值中提取指定属性值（如 name / filename）
   * 兼容带引号与不带引号写法，属性名不区分大小写，=号两侧允许空白
   * @param headerValue Content-Disposition 头值，如 form-data; name="file"; filename="a.xlsx"
   * @param attr 属性名（name / filename）
   * @returns 属性值（已去空白、去成对包裹引号）；找不到返回空字符串
   */
  private extractMultipartParam(headerValue: string, attr: string): string {
    const re = new RegExp('(?:^|;)\\s*' + attr + '\\s*=\\s*("([^"]*)"|([^;]*))', 'i');
    const m = headerValue.match(re);
    if (!m) return '';
    const val = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : '';
    return this.stripPairedQuotes(val.trim());
  }

  /**
   * 【新增】查找 multipart 段中「头部 与 正文」的空行分隔位置（\r\n\r\n 或 \n\n），找不到返回 -1
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

      // 【Bug2 修复】shell 单引号「闭合-转义-重开」模式：...'\''...（curlGenerator.quoteArg 对含撇号的值输出
      // close-quote + \' + reopen-quote）。当单引号状态读到 ' 且后随 \' 时，把字面撇号追加进 current 并整体
      // 跳过转义符与其后的重开引号（i += 2），不视为引号结束；否则才按普通结束引号处理
      // （如 it'\''s 应 tokenize 为 it's，而非错误拆断成 it\s）
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