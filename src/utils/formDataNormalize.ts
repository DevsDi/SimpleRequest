import { HttpRequest } from '@/types';

/**
 * 归一化 form-data content：剥掉文本条目 value 最外层的一层成对包裹双引号
 * 背景：旧版 curlParser/导入逻辑会把 form-data 文本值序列化为 name="value"（带一层成对双引号），
 * 而无引号 name=value 的文本值不受影响。启动时一次性迁移后，展示/发送/去重/导出三端数据一致。
 *
 * 规则（逐字对齐 FormdataEditor.parseFormData、curlParser.stripPairedQuotes）：
 * - 文件条目不得改动：判定与新 curlGenerator.classifyFormDataLine 一致，
 *   即 line.indexOf('=@') 下标 > 0 且 '=@' 之后含 ;type= 或 ;base64,
 * - 文本条目：在第一个 '=' 处拆 key/value；value 满足
 *   value.length >= 2 && value.startsWith('"') && value.endsWith('"') 时，
 *   slice(1, -1) 仅剥掉一层成对包裹双引号（内部引号不处理）
 * - 其余保持原样：key 不 trim、value 只剥引号其余不动、无 '=' 的行（含空行）原样保留，
 *   最终用 '\n' 重组；空 content 直接返回原值
 * @param content 原始 form-data content 字符串
 * @returns 归一化后的 content 字符串（无变化时与原字符串全等）
 */
export function normalizeFormDataContent(content: string): string {
  if (!content) return content;

  return content
    .split('\n')
    .map((line) => {
      // 文件条目：=@ 下标 > 0 且其后含 ;type= 或 ;base64, 时视为文件条目，字节不动
      const fileMarkerIdx = line.indexOf('=@');
      const afterMarker = fileMarkerIdx > 0 ? line.slice(fileMarkerIdx + 2) : '';
      if (fileMarkerIdx > 0 && (afterMarker.includes(';type=') || afterMarker.includes(';base64,'))) {
        return line;
      }

      // 文本条目：在第一个 '=' 处拆 key/value
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) return line;
      const key = line.slice(0, eqIdx);
      const value = line.slice(eqIdx + 1);

      // 仅剥掉一层成对包裹双引号（与 FormdataEditor 约 79-85 行、curlParser.stripPairedQuotes 逐字一致）
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return `${key}=${value.slice(1, -1)}`;
      }
      return line;
    })
    .join('\n');
}

/**
 * 若请求为 form-data，返回 body.content 归一化后的请求副本；否则原样返回原请求对象
 * @param request 请求配置
 * @returns 归一化后的请求（无变化时返回原对象引用）
 */
export function normalizeRequestContent(request: HttpRequest): HttpRequest {
  if (request.body?.type === 'form-data') {
    const normalized = normalizeFormDataContent(request.body.content);
    if (normalized !== request.body.content) {
      return { ...request, body: { ...request.body, content: normalized } };
    }
  }
  return request;
}