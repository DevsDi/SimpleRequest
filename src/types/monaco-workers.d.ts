// Monaco Editor worker type declarations
declare module 'monaco-editor/esm/vs/editor/editor.worker?worker' {
  export default class EditorWorker extends Worker {
    constructor();
  }
}

declare module 'monaco-editor/esm/vs/language/json/json.worker?worker' {
  export default class JsonWorker extends Worker {
    constructor();
  }
}
