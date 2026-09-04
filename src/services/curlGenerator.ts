import { HttpRequest, AuthConfig } from '@/types';

/** 已解析的 form-data 导出条目 */
interface FormDataEntry {
  /** 条目内容：key=value 或 key=@/path/to/文件名 */
  entry: string;
  /** 是否用 --form-string 字面量发送（文本值含 curl -F 魔法语法时为 true） */
  useFormString: boolean;
}

/**
 * Curl command generator
 * Converts HttpRequest configuration to a curl command string
 */
class CurlGenerator {
  /** 允许携带 body 的 HTTP 方法（与 addBody 的门控一致，头过滤也按此判定：仅方法允许 body 且会真正输出 -F 时才跳过手动 Content-Type） */
  private static readonly BODY_ALLOWED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

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
      .filter(h => {
        if (!(h.enabled && h.key.trim())) {
          return false;
        }
        // form-data 的 Content-Type（含 boundary）由 curl -F 自动生成；发送端 buildHeaders 对 form-data 本就
        // 剥离手动 Content-Type，导出端保持一致，统一忽略手动值。仅在 body 内容非空且 method 属于允许携带
        // body 的方法（会真正输出 -F）时才跳过，其余情况（内容为空或 GET/HEAD 等方法）仍输出该头，
        // 与 addBody 的触发条件一致
        if (
          request.body?.type === 'form-data' &&
          request.body.content?.trim() &&
          CurlGenerator.BODY_ALLOWED_METHODS.includes(request.method) &&
          h.key.toLowerCase() === 'content-type'
        ) {
          return false;
        }
        return true;
      })
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
    if (!CurlGenerator.BODY_ALLOWED_METHODS.includes(method)) {
      return;
    }

    const content = body.content.trim();
    if (!content) return;

    switch (body.type) {
      case 'raw':
        // Raw content (JSON, text, XML, HTML, JavaScript)
        parts.push(`-d ${this.quoteArg(content)}`);
        break;

      case 'x-www-form-urlencoded': {
        // URL-encoded form data
        const encodedData = this.parseUrlencoded(content);
        if (encodedData) {
          parts.push(`-d ${this.quoteArg(encodedData)}`);
        }
        break;
      }

      case 'form-data': {
        // Multipart form-data - 按条目导出 -F（-d 的语义是 urlencoded/raw body，无法复现 multipart 请求）
        // 文本条目：-F 'key=value'；文件条目：-F 'key=@/path/to/文件名'（含非空 ;type=MIME；占位路径需手动改为实际文件路径）
        // 文本值以 @ 开头（上传文件）、< 开头（读文件内容）、含任意 ;（curl -F 会把 ; 之后的片段当部件头解析）
        // 或以 " 开头（curl -F 会做 quoted-word 解析剥除首尾双引号），均会被 curl -F 误读，
        // 需改用 --form-string 以字面量发送，与扩展对文本条目原样 append 的发送语义保持一致
        const formDataEntries = this.parseFormData(content);
        const formDataOptions = this.getFormDataOptions(content);
        formDataEntries.forEach((entry, index) => {
          const option = formDataOptions[index] || '-F';
          parts.push(`${option} ${this.quoteArg(entry)}`);
        });
        break;
      }
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
   * Output: 条目数组（每条对应一个 -F/--form-string 参数）：文本条目为 key=value，
   *         文件条目为 key=@/path/to/文件名（含非空 ;type=MIME；占位路径需手动改为实际文件路径）
   */
  private parseFormData(content: string): string[] {
    return this.buildFormDataEntries(content).map(item => item.entry);
  }

  /**
   * 解析一行 form-data 内容为导出条目
   * Input: key=value 或 key=@filename;type=mimetype;base64,data
   * Output: 分类结果：文本条目 entry=key=value；文件条目 entry=key=@/path/to/文件名（含非空 ;type=MIME；
   *         占位路径需手动改为实际文件路径）；无法解析出 key 的行返回 null（与 parseFormData 的跳过规则保持一致）
   */
  private classifyFormDataLine(line: string): FormDataEntry | null {
    const fileMarkerIdx = line.indexOf('=@');
    // 与编辑器/发送端判定保持一致：=@ 之后需含 ;type= 或 ;base64, 才视为文件条目，
    // 否则文本值中偶然含有 =@ 的普通条目会被误导出为文件
    const afterMarker = fileMarkerIdx > 0 ? line.slice(fileMarkerIdx + 2) : '';
    if (fileMarkerIdx > 0 && (afterMarker.includes(';type=') || afterMarker.includes(';base64,'))) {
      // File entry - extract key, filename placeholder and optional 非空 MIME
      // 文件条目始终用 -F（curl 的 =@ 即上传文件语法），不受 --form-string 条件影响
      const key = line.slice(0, fileMarkerIdx).trim();
      const filePart = afterMarker;
      const semicolonIdx = filePart.indexOf(';');
      const fileName = semicolonIdx > 0 ? filePart.slice(0, semicolonIdx) : filePart;
      // 提取 ;type= 的 MIME（可能为空，如 ;type=;base64, 对应 UI 未选文件占位）；仅当非空时才拼入导出，
      // 避免输出空的 ;type=
      const typeMatch = /;type=([^;]*)/.exec(afterMarker);
      const mimeType = typeMatch ? typeMatch[1].trim() : '';
      const typeSuffix = mimeType ? `;type=${mimeType}` : '';
      return { entry: `${key}=@/path/to/${fileName}${typeSuffix}`, useFormString: false };
    }

    // Text entry
    const [key, ...valueParts] = line.split('=');
    if (!key?.trim()) {
      return null;
    }
    const value = valueParts.join('=').trim();
    // curl -F 有魔法语法：值以 @ 开头=上传文件、< 开头=读文件内容；值内出现任意 ; 时，; 之后的片段都会被 curl
    // 当作部件头参数解析（不只是 ;type=/;filename=，如 key=a;b、secret=abc;base64,xyz 的尾部也会被误读）；
    // 值以双引号开头时，curl 会进入 quoted-word 解析，成对剥除首尾双引号并反转义内部 \" 与 \\，导出的引号会丢失。
    // 扩展自身对文本条目是字面量发送，因此值内出现 @、<、; 或值以 " 开头的文本值导出必须一律改用 --form-string 保持字面语义
    const useFormString =
      value.startsWith('@') ||
      value.startsWith('<') ||
      value.includes(';') ||
      value.startsWith('"');
    return { entry: `${key}=${value}`, useFormString };
  }

  /**
   * 逐行解析 form-data 内容，返回导出条目及各自应使用的参数
   */
  private buildFormDataEntries(content: string): FormDataEntry[] {
    const result: FormDataEntry[] = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      const classified = this.classifyFormDataLine(line);
      if (classified) result.push(classified);
    }
    return result;
  }

  /**
   * 计算每条 form-data 条目应使用的 curl 参数（-F 或 --form-string）
   * 与 parseFormData 逐行对应，便于 addBody 导出时逐条选择
   */
  private getFormDataOptions(content: string): string[] {
    return this.buildFormDataEntries(content).map(item => (item.useFormString ? '--form-string' : '-F'));
  }

  /**
   * Quote argument for shell
   * Uses single quotes for safety (no variable expansion / command substitution).
   * 统一使用单引号包裹：单引号内 $、反引号、反斜杠、双引号均为字面量，不会被 shell 展开或破坏；
   * 值中的撇号用 '\'' 闭合拼接转义（close-quote + escaped-quote + reopen-quote），对任意字符均安全，
   * 包括值末尾的反斜杠（旧的仅转义双引号方案会被尾反斜杠吞掉闭合引号，且 $HOME 会被错误展开）
   */
  private quoteArg(arg: string): string {
    return `'${arg.replace(/'/g, `'\\''`)}'`;
  }
}

export const curlGenerator = new CurlGenerator();