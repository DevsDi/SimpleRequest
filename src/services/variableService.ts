import { HttpRequest, Variable } from '@/types';
import { VARIABLE_REGEX, HTTP_DOMAIN_PREFIXES } from '@/utils/constants';

/**
 * 变量服务
 * 处理变量的替换和 URL 协议智能判断
 */
class VariableService {
  /**
   * 替换字符串中的变量
   * @param text 包含 {{变量名}} 的文本
   * @param variables 变量列表
   * @returns 替换后的文本
   */
  replaceVariables(text: string, variables: Variable[]): string {
    if (!text || variables.length === 0) {
      return text;
    }

    // 只处理启用的变量
    const enabledVars = variables.filter((v) => v.enabled && v.name.trim());

    return text.replace(VARIABLE_REGEX, (match, varName) => {
      const trimmedName = varName.trim();
      const variable = enabledVars.find((v) => v.name === trimmedName);
      return variable ? variable.value : match; // 未找到变量则保留原样
    });
  }

  /**
   * 智能添加协议
   * @param url 用户输入的 URL
   * @returns 完整 URL（带协议）
   */
  normalizeUrl(url: string): string {
    if (!url) {
      return url;
    }

    // 已有协议，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // 提取域名部分（去掉路径和端口）
    const domainPart = url.split('/')[0].split(':')[0];

    // localhost/内网IP → http
    const shouldUseHttp = HTTP_DOMAIN_PREFIXES.some((prefix) =>
      domainPart === prefix || domainPart.startsWith(prefix)
    );

    return shouldUseHttp ? 'http://' + url : 'https://' + url;
  }

  /**
   * 处理请求中的所有变量（URL、Headers、Body）
   * @param request 原始请求
   * @param variables 变量列表
   * @returns 替换后的请求（深拷贝）
   */
  processRequest(request: HttpRequest, variables: Variable[]): HttpRequest {
    // 深拷贝请求，避免修改原对象
    const processed: HttpRequest = {
      ...request,
      headers: request.headers.map((h) => ({ ...h })),
      body: { ...request.body },
    };

    // 替换 URL
    processed.url = this.replaceVariables(processed.url, variables);

    // 替换 Headers
    processed.headers = processed.headers.map((h) => ({
      ...h,
      key: this.replaceVariables(h.key, variables),
      value: this.replaceVariables(h.value, variables),
    }));

    // 替换 Body
    if (processed.body.content) {
      processed.body.content = this.replaceVariables(processed.body.content, variables);
    }

    return processed;
  }
}

export const variableService = new VariableService();