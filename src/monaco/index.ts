// 自定义 Monaco Editor 导入 - 最小化配置
// 只导入 API，让 treeshake 移除不需要的代码

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// 只注册 JSON 语言支持
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';

// 导出 monaco 对象
export { monaco };
