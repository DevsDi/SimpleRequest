import { HttpRequest } from '@/types';

/**
 * Normalize form-data content: strip one layer of paired surrounding double quotes from the outer part of a text entry's value
 * Background: the old curlParser/import logic serialized form-data text values as name="value" (with one layer of paired double quotes),
 * while unquoted name=value text values were unaffected. After a one-time migration at startup, display/send/dedup/export are all consistent.
 *
 * Rules (verbatim-aligned with FormdataEditor.parseFormData and curlParser.stripPairedQuotes):
 * - File entries must not be changed: the detection matches the new curlGenerator.classifyFormDataLine,
 *   i.e. line.indexOf('=@') index > 0 and ;type= or ;base64, follows '=@'
 * - Text entry: split key/value at the first '='; when the value satisfies
 *   value.length >= 2 && value.startsWith('"') && value.endsWith('"'),
 *   slice(1, -1) strips only one layer of paired surrounding double quotes (inner quotes are untouched)
 * - Everything else stays as-is: key is not trimmed, value is only quote-stripped and otherwise untouched, lines without '=' (including blank lines) are kept verbatim,
 *   and the result is reassembled with '\n'; empty content is returned as-is
 * @param content The raw form-data content string
 * @returns The normalized content string (identical to the original when nothing changed)
 */
export function normalizeFormDataContent(content: string): string {
  if (!content) return content;

  return content
    .split('\n')
    .map((line) => {
      // File entry: when the =@ index is > 0 and ;type= or ;base64, follows it, treat it as a file entry and leave it byte-for-byte untouched
      const fileMarkerIdx = line.indexOf('=@');
      const afterMarker = fileMarkerIdx > 0 ? line.slice(fileMarkerIdx + 2) : '';
      if (fileMarkerIdx > 0 && (afterMarker.includes(';type=') || afterMarker.includes(';base64,'))) {
        return line;
      }

      // Text entry: split key/value at the first '='
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) return line;
      const key = line.slice(0, eqIdx);
      const value = line.slice(eqIdx + 1);

      // Strip only one layer of paired surrounding double quotes (verbatim-aligned with FormdataEditor around lines 79-85 and curlParser.stripPairedQuotes)
      if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return `${key}=${value.slice(1, -1)}`;
      }
      return line;
    })
    .join('\n');
}

/**
 * If the request is form-data, return a copy of the request with body.content normalized; otherwise return the original request object
 * @param request The request configuration
 * @returns The normalized request (returns the original object reference when nothing changed)
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