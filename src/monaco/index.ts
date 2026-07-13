// 自定义 Monaco Editor 导入 - 最小化配置
// 只导入 API，让 treeshake 移除不需要的代码

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { loader } from '@monaco-editor/react';

// 只注册 JSON 语言支持
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';

// 配置 loader 使用本地 monaco，避免 CDN 加载
loader.config({ monaco });

// 立即初始化，防止 CDN 请求
// 使用 warn 级别日志，不阻塞应用启动
loader.init().catch((err) => {
  console.warn('[Monaco] Loader init warning:', err);
});

// 导出 monaco 对象
export { monaco };
