import { HttpMethod, Header, RequestBody, HttpRequest } from '@/types';

/**
 * curl命令解析结果
 */
interface CurlParseResult {
  method: HttpMethod;
  url: string;
  headers: Header[];
  body: RequestBody | null;
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
          result.body = {
            type: this.detectBodyType(result.headers, bodyContent),
            content: bodyContent,
          };
          // 如果没有指定方法,有body时默认POST
          if (result.method === 'GET') {
            result.method = 'POST';
          }
          break;

        case '-u':
        case '--user':
          const authStr = tokens[++i] || '';
          result.headers.push({
            key: 'Authorization',
            value: `Basic ${btoa(authStr)}`,
            enabled: true,
          });
          break;

        default:
          // URL识别
          if (token.startsWith('http://') || token.startsWith('https://')) {
            result.url = token;
          } else if (token.startsWith('curl')) {
            // 忽略curl命令本身
          }
      }
    }

    return result;
  }

  /**
   * 清理命令
   */
  private normalizeCommand(cmd: string): string {
    // 移除反斜杠换行
    return cmd.replace(/\\\s*\n/g, ' ').replace(/\\\s*/g, '').trim();
  }

  /**
   * 分词(处理引号)
   */
  private tokenize(cmd: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let i = 0; i < cmd.length; i++) {
      const char = cmd[i];

      if (!inQuote && (char === '"' || char === "'")) {
        inQuote = true;
        quoteChar = char;
        continue;
      }

      if (inQuote && char === quoteChar) {
        inQuote = false;
        quoteChar = '';
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
      // 尝试根据内容判断是否是JSON
      try {
        JSON.parse(body);
        return 'json';
      } catch {
        return 'raw';
      }
    }

    const ct = contentType.value.toLowerCase();
    if (ct.includes('application/json')) return 'json';
    if (ct.includes('multipart/form-data')) return 'form-data';
    if (ct.includes('application/x-www-form-urlencoded')) {
      return 'x-www-form-urlencoded';
    }

    return 'raw';
  }
}

export const curlParser = new CurlParser();