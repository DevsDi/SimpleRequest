// Custom Monaco Editor import - minimal configuration
// Only import the API so tree-shaking can remove unneeded code

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { loader } from '@monaco-editor/react';

// Only register JSON language support
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';

// Configure the loader to use the local monaco, avoiding CDN loading
loader.config({ monaco });

// Initialize immediately to prevent CDN requests
// Use warn-level logging so it does not block app startup
loader.init().catch((err) => {
  console.warn('[Monaco] Loader init warning:', err);
});

// Export the monaco object
export { monaco };
