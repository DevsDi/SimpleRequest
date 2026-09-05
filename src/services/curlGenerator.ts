import { HttpRequest, AuthConfig } from '@/types';

/** Parsed form-data export entry */
interface FormDataEntry {
  /** Entry content: key=value or key=@/path/to/filename */
  entry: string;
  /** Whether to send as a literal using --form-string (true when the text value contains curl -F magic syntax) */
  useFormString: boolean;
}

/**
 * Curl command generator
 * Converts HttpRequest configuration to a curl command string
 */
class CurlGenerator {
  /** HTTP methods that may carry a body (consistent with addBody's gate; header filtering also uses this: only skip the manual Content-Type when the method allows a body and -F will actually be emitted) */
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
        // The Content-Type (including boundary) for form-data is generated automatically by curl -F; the send
        // side (buildHeaders) already strips the manual Content-Type for form-data, so the export side follows
        // suit and always ignores the manual value. Skip it only when the body content is non-empty and the
        // method allows a body (i.e. -F will actually be emitted); otherwise (empty content, or methods like
        // GET/HEAD) the header is still output, matching addBody's trigger condition
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
        // Multipart form-data - export each entry as -F (-d has the semantics of a urlencoded/raw body and cannot reproduce a multipart request)
        // Text entry: -F 'key=value'; file entry: -F 'key=@/path/to/filename' (includes non-empty ;type=MIME; the placeholder path must be changed to the real file path)
        // Text values starting with @ (upload file), with < (read file content), containing any ; (curl -F parses the segment after ; as part headers),
        // or starting with " (curl -F does quoted-word parsing, stripping surrounding double quotes) are all misread by curl -F,
        // so they must be sent as a literal with --form-string instead, matching the extension's send semantics of appending text entries as-is
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
   * Output: array of entries (each corresponds to a -F/--form-string argument): text entries are key=value,
   *         file entries are key=@/path/to/filename (includes non-empty ;type=MIME; the placeholder path must be changed to the real file path)
   */
  private parseFormData(content: string): string[] {
    return this.buildFormDataEntries(content).map(item => item.entry);
  }

  /**
   * Parse one line of form-data content into an export entry
   * Input: key=value or key=@filename;type=mimetype;base64,data
   * Output: classification result: text entries are entry=key=value; file entries are entry=key=@/path/to/filename (includes non-empty ;type=MIME;
   *         the placeholder path must be changed to the real file path); lines with no parseable key return null (consistent with parseFormData's skip rule)
   */
  private classifyFormDataLine(line: string): FormDataEntry | null {
    const fileMarkerIdx = line.indexOf('=@');
    // Consistent with the editor/send-side detection: only when ;type= or ;base64, follows =@ is it treated as a file entry,
    // otherwise an ordinary text entry whose value happens to contain =@ would be wrongly exported as a file
    const afterMarker = fileMarkerIdx > 0 ? line.slice(fileMarkerIdx + 2) : '';
    if (fileMarkerIdx > 0 && (afterMarker.includes(';type=') || afterMarker.includes(';base64,'))) {
      // File entry - extract key, filename placeholder and optional non-empty MIME
      // File entries always use -F (curl's =@ is the file-upload syntax) and are not affected by the --form-string condition
      const key = line.slice(0, fileMarkerIdx).trim();
      const filePart = afterMarker;
      const semicolonIdx = filePart.indexOf(';');
      const fileName = semicolonIdx > 0 ? filePart.slice(0, semicolonIdx) : filePart;
      // Extract the MIME from ;type= (may be empty, e.g. ;type=;base64, corresponds to the UI placeholder where no file is selected); only append it to the export when non-empty,
      // to avoid emitting an empty ;type=
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
    // curl -F has magic syntax: a value starting with @ uploads a file, < reads file content; when the value contains any ;,
    // curl parses everything after the ; as part-header parameters (not just ;type=/;filename= - e.g. the tails of key=a;b and secret=abc;base64,xyz are misread too);
    // when the value starts with a double quote, curl enters quoted-word parsing, stripping a surrounding pair of double quotes and
    // unescaping inner \" and \\, so exported quotes get lost.
    // The extension itself sends text entries literally, so any text value containing @, <, ; or starting with " must be exported
    // with --form-string to preserve the literal semantics
    const useFormString =
      value.startsWith('@') ||
      value.startsWith('<') ||
      value.includes(';') ||
      value.startsWith('"');
    return { entry: `${key}=${value}`, useFormString };
  }

  /**
   * Parse form-data content line by line, returning the export entries and the argument each should use
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
   * Compute the curl argument (-F or --form-string) each form-data entry should use
   * Corresponds to parseFormData line by line, so addBody can pick per entry when exporting
   */
  private getFormDataOptions(content: string): string[] {
    return this.buildFormDataEntries(content).map(item => (item.useFormString ? '--form-string' : '-F'));
  }

  /**
   * Quote argument for shell
   * Uses single quotes for safety (no variable expansion / command substitution).
   * Always wraps in single quotes: inside single quotes $, backticks, backslashes and double quotes are all literals and are not expanded or broken by the shell;
   * apostrophes in the value are escaped with the '\'' close-reopen pattern (close-quote + escaped-quote + reopen-quote), which is safe for any character,
   * including a trailing backslash (the old double-quote-only escaping scheme would let a trailing backslash swallow the closing quote, and $HOME would be wrongly expanded)
   */
  private quoteArg(arg: string): string {
    return `'${arg.replace(/'/g, `'\\''`)}'`;
  }
}

export const curlGenerator = new CurlGenerator();