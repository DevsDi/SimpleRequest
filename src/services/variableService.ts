import { HttpRequest, Variable } from '@/types';
import { VARIABLE_REGEX, HTTP_DOMAIN_PREFIXES } from '@/utils/constants';

/**
 * Variable service
 * Handles variable replacement and smart URL protocol detection
 */
class VariableService {
  /**
   * Replace variables in string
   * @param text Text containing {{variableName}} placeholders
   * @param variables Variable list
   * @returns Replaced text
   */
  replaceVariables(text: string, variables: Variable[]): string {
    if (!text || variables.length === 0) {
      return text;
    }

    // Only process enabled variables
    const enabledVars = variables.filter((v) => v.enabled && v.name.trim());

    return text.replace(VARIABLE_REGEX, (match, varName) => {
      const trimmedName = varName.trim();
      const variable = enabledVars.find((v) => v.name === trimmedName);
      return variable ? variable.value : match; // Keep original if variable not found
    });
  }

  /**
   * Smart add protocol
   * @param url User input URL
   * @returns Complete URL (with protocol)
   */
  normalizeUrl(url: string): string {
    if (!url) {
      return url;
    }

    // Already has protocol, return directly
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Extract domain part (remove path and port)
    const domainPart = url.split('/')[0].split(':')[0];

    // localhost/internal IP -> http
    const shouldUseHttp = HTTP_DOMAIN_PREFIXES.some((prefix) =>
      domainPart === prefix || domainPart.startsWith(prefix)
    );

    return shouldUseHttp ? 'http://' + url : 'https://' + url;
  }

  /**
   * 处理请求中的所有变量（URL、Headers、Body、Auth）
   * @param request 原始请求
   * @param variables 变量列表
   * @returns 替换后的请求（深拷贝）
   */
  processRequest(request: HttpRequest, variables: Variable[]): HttpRequest {
    // 如果没有变量，直接返回深拷贝
    if (!variables || variables.length === 0) {
      return {
        ...request,
        headers: request.headers.map((h) => ({ ...h })),
        body: { ...request.body },
        auth: { ...request.auth },
      };
    }

    // 深拷贝请求
    const processed: HttpRequest = {
      ...request,
      headers: request.headers.map((h) => ({ ...h })),
      body: { ...request.body },
      auth: { ...request.auth },
    };

    // 替换 URL 中的变量
    processed.url = this.replaceVariables(processed.url, variables);

    // 替换 Headers 中的变量
    processed.headers = processed.headers.map((h) => ({
      ...h,
      key: this.replaceVariables(h.key, variables),
      value: this.replaceVariables(h.value, variables),
    }));

    // 替换 Body 中的变量
    if (processed.body.content) {
      processed.body.content = this.replaceVariables(processed.body.content, variables);
    }

    // 替换 Auth 中的变量
    if (processed.auth) {
      if (processed.auth.apiKey) {
        processed.auth.apiKey = { ...processed.auth.apiKey };
        processed.auth.apiKey.key = this.replaceVariables(processed.auth.apiKey.key, variables);
        processed.auth.apiKey.value = this.replaceVariables(processed.auth.apiKey.value, variables);
      }
      if (processed.auth.bearerToken) {
        processed.auth.bearerToken = { ...processed.auth.bearerToken };
        processed.auth.bearerToken.token = this.replaceVariables(processed.auth.bearerToken.token, variables);
      }
      if (processed.auth.basicAuth) {
        processed.auth.basicAuth = { ...processed.auth.basicAuth };
        processed.auth.basicAuth.username = this.replaceVariables(processed.auth.basicAuth.username, variables);
        processed.auth.basicAuth.password = this.replaceVariables(processed.auth.basicAuth.password, variables);
      }
      if (processed.auth.oauth2) {
        processed.auth.oauth2 = { ...processed.auth.oauth2 };
        processed.auth.oauth2.accessToken = this.replaceVariables(processed.auth.oauth2.accessToken, variables);
      }
    }

    return processed;
  }
}

export const variableService = new VariableService();