import { HttpMethod, Header, RequestBody, HttpRequest, AuthConfig, RawContentType } from '@/types';

/**
 * curl命令解析结果
 */
interface CurlParseResult {
  method: HttpMethod;
  url: string;
  headers: Header[];
  body: RequestBody | null;
  auth?: AuthConfig;
}

/**
 * curl命令解析器
 * 将curl命令转换为请求配置
 */
class CurlParser {
  /**
   * 解析curl命令
   * @param command curl命令字符串
   * @returns 请求配置
   */
  parse(command: string): HttpRequest {
    const result = this.parseCurl(command);

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: result.url.split('/').pop() || 'curl导入',
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
   * 内部解析方法
   */
  private parseCurl(command: string): CurlParseResult {
    // 清理命令(移除换行和多余空格)
    const cleaned = this.normalizeCommand(command);

    // 分词(处理引号)
    const tokens = this.tokenize(cleaned);

    // 解析参数
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
          // 如果没有指定方法,有body时默认POST
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
          // URL识别
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
   * 清理命令
   * 只移除 curl 续行的反斜杠，保留 JSON 内容中的转义字符
   */
  private normalizeCommand(cmd: string): string {
    // 移除反斜杠+换行（curl续行符）
    // 移除行尾的反斜杠
    return cmd.replace(/\\\n/g, ' ').replace(/\\(\s*)$/gm, '').trim();
  }

  /**
   * 分词(处理引号，包括 ANSI-C quoting $'...' 格式)
   */
  private tokenize(cmd: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';
    let isAnsiCQuoting = false; // $'...' 格式

    for (let i = 0; i < cmd.length; i++) {
      const char = cmd[i];

      // 检测 ANSI-C quoting: $'...'
      if (!inQuote && char === '$' && cmd[i + 1] === "'") {
        inQuote = true;
        quoteChar = "'";
        isAnsiCQuoting = true;
        i++; // 跳过 $
        continue;
      }

      if (!inQuote && (char === '"' || char === "'")) {
        inQuote = true;
        quoteChar = char;
        isAnsiCQuoting = false;
        continue;
      }

      if (inQuote && char === '\\' && isAnsiCQuoting) {
        // ANSI-C quoting 转义处理
        const nextChar = cmd[i + 1];
        if (nextChar === "'") {
          // \' -> '
          current += "'";
          i++;
          continue;
        } else if (nextChar === 'u' && cmd.slice(i + 2, i + 6).match(/[0-9a-fA-F]{4}/)) {
          // \uXXXX -> Unicode 字符
          const hex = cmd.slice(i + 2, i + 6);
          current += String.fromCharCode(parseInt(hex, 16));
          i += 5; // 跳过 \uXXXX
          continue;
        } else if (nextChar === 'n') {
          // \n -> 换行
          current += '\n';
          i++;
          continue;
        } else if (nextChar === 't') {
          // \t -> 制表符
          current += '\t';
          i++;
          continue;
        } else if (nextChar === 'r') {
          // \r -> 回车
          current += '\r';
          i++;
          continue;
        } else if (nextChar === '\\') {
          // \\ -> \
          current += '\\';
          i++;
          continue;
        }
        // 其他情况保留反斜杠
        current += char;
        continue;
      }

      if (inQuote && char === quoteChar && !isAnsiCQuoting) {
        // 普通引号结束（非 ANSI-C quoting）
        inQuote = false;
        quoteChar = '';
        continue;
      }

      // ANSI-C quoting 中单引号需要转义才能出现，所以直接遇到的单引号就是结束
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
   * 根据请求头检测body类型
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