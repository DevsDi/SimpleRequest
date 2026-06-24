# Variable Autocomplete & Multi-Tab Design

日期: 2026-06-24
状态: Draft

## 概述

为 SimpleRequest 添加两个功能：
1. **变量自动提示** - URL 输入框中输入 `{{` 时弹出变量列表
2. **多 Tab 支持** - Postman 风格的标签页，自动保存，重新打开后恢复

## 需求确认

### 变量自动提示
- 仅在 URL 输入框生效
- 输入 `{{` 触发下拉菜单
- 显示已启用的变量列表
- 支持键盘导航和过滤

### 多 Tab
- Postman 风格标签栏
- 自动保存到 chrome.storage.local
- 重新打开后自动恢复
- 不做 Collection 功能（已有 History）

## 架构设计

### 整体结构

```
┌─────────────────────────────────────────────────────────┐
│                        App.tsx                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │              TabBar (新增)                        │  │
│  │  [Tab1] [Tab2] [Tab3] [+]                         │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │              RequestPanel                          │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  URL输入框 + VariableAutocomplete (新增)    │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │  [Params] [Authorization] [Headers] [Body]        │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │              ResponsePanel                         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 状态结构

**新增类型定义：**

```typescript
interface Tab {
  id: string;           // 与 HttpRequest.id 关联
  name: string;         // 显示名称（自动生成：method + URL 片段）
  createdAt: number;    // 创建时间
}
```

**说明：** Tab 顺序由数组顺序决定，不需要单独 order 字段。名称自动更新，不允许用户手动修改。

**Store 结构变更：**

```typescript
interface AppState {
  // 原 currentRequest 改为多 Tab 结构
  tabs: Tab[];
  requests: Record<string, HttpRequest>;
  responses: Record<string, HttpResponse | null>;
  activeTabId: string | null;
  
  // 变量保持不变
  variables: Variable[];
  
  // 新增 Tab 操作
  addTab: () => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  
  // 原 currentRequest 相关方法调整
  getCurrentRequest: () => HttpRequest | null;
  updateCurrentRequest: (partial: Partial<HttpRequest>) => void;
  getCurrentResponse: () => HttpResponse | null;
  setCurrentResponse: (response: HttpResponse | null) => void;
  
  // 保留原有方法
  // history, variables 等
}
```

## 组件设计

### 1. VariableAutocomplete 组件

**路径**: `src/popup/components/RequestPanel/VariableAutocomplete.tsx`

**Props:**
```typescript
interface VariableAutocompleteProps {
  variables: Variable[];
  onSelect: (variableName: string) => void;
  position: { top: number; left: number };
  filter?: string;
  onClose: () => void;
}
```

**行为:**
1. 监听 URL 输入框的 `input` 和 `selectionchange` 事件
2. 检测光标位置前是否有 `{{`
3. 解析 `{{` 后的文本作为过滤条件
4. 显示匹配的已启用变量
5. 支持键盘 `↑` `↓` 导航，`Enter` 选择，`Escape` 关闭
6. 选择后插入 `{{variableName}}`，光标移到 `}}` 后

**UI:**
- 下拉菜单使用 `position: absolute` + `z-index`
- 每个选项显示：变量名 + 变量值预览（截断）
- 高亮过滤匹配的文字
- 无匹配时显示"无可用变量"

### 2. TabBar 组件

**路径**: `src/popup/components/TabBar/TabBar.tsx`

**Props:**
```typescript
interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  requests: Record<string, HttpRequest>;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onSwitchTab: (id: string) => void;
}
```

**UI 设计:**
- 位置：Header 下方，RequestPanel 上方
- 每个 Tab 显示：
  - HTTP 方法颜色标记（GET 绿色，POST 黄色等）
  - 名称（截断到 ~20 字符）
  - 悬停显示关闭按钮 "×"
- 最右侧 "+" 按钮新建 Tab
- Tab 过多时支持横向滚动
- 激活 Tab 有底部高亮边框

**交互:**
- 点击 Tab 切换（保存当前请求状态）
- 点击 "+" 新建 Tab（复制当前请求，或创建默认请求）
- 点击 "×" 关闭 Tab
- 最后一个 Tab 禁止关闭

**Tab 名称自动更新规则:**
- 名称格式：`${method} ${urlPath}`（如 `GET /api/users`）
- URL 为空时显示：`${method} Untitled`
- 截断到 25 字符，超出显示 `...`
- 每次修改 method 或 URL 时自动更新

## 持久化策略

### storageService 新增方法

```typescript
// 保存所有 Tab 和 Request 数据
saveTabsData(data: { 
  tabs: Tab[]; 
  requests: Record<string, HttpRequest>;
  responses: Record<string, HttpResponse | null>;
  activeTabId: string | null;
}): Promise<void>;

// 加载 Tab 数据
loadTabsData(): Promise<{ 
  tabs: Tab[]; 
  requests: Record<string, HttpRequest>;
  responses: Record<string, HttpResponse | null>;
  activeTabId: string | null;
} | null>;
```

**说明：** Response 数据也持久化，这样用户重新打开可以看到之前的响应结果。
```

### 保存时机

| 事件 | 操作 |
|------|------|
| 切换 Tab | 保存当前 Request 和 Response |
| 关闭 Tab | 移除对应数据并保存 |
| 新建/修改 Request | debounce 300ms 后保存 |
| 发送请求 | 保存 Response |
| 扩展关闭/刷新 | beforeunload 事件触发保存 |

### 数据迁移

首次升级时检测旧数据：
- 如果存在 `currentRequest` 但无 `tabs`，将其转为第一个 Tab
- 保留 History 和 Variables 数据不变

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| 首次升级（旧数据） | 自动迁移 currentRequest 为第一个 Tab |
| 关闭最后一个 Tab | 禁止关闭，保留至少一个 Tab |
| Tab 数量限制 | 最多 20 个，超出时提示 |
| 变量列表为空 | 下拉菜单显示"暂无变量，请在 Variables 面板添加" |
| 变量名重复 | 允许，下拉菜单显示所有同名变量 |
| URL 输入框失焦 | 关闭自动提示菜单 |

## 与现有功能的兼容

| 功能 | 兼容处理 |
|------|----------|
| History | 保持不变，发送请求后仍记录到 History |
| 变量系统 | 保持不变，仅添加 UI 提示 |
| curl 导入 | 导入到当前激活的 Tab |
| 响应面板 | 跟随当前 Tab 切换显示对应 Response |
| 拖拽布局 | 保持不变 |

## 文件结构

```
src/
├── popup/
│   ├── App.tsx                    # 添加 TabBar
│   ├── App.scss                   # 添加 TabBar 样式
│   └── components/
│       ├── TabBar/                # 新增
│       │   ├── index.ts
│       │   ├── TabBar.tsx
│       │   └── TabBar.scss
│       └── RequestPanel/
│           ├── RequestPanel.tsx   # 集成 VariableAutocomplete
│           ├── VariableAutocomplete.tsx  # 新增
│           └── VariableAutocomplete.scss # 新增
├── store/
│   └── index.ts                   # 重构：多 Tab 状态
├── services/
│   └── storageService.ts          # 新增 Tab 持久化
└── types/
    └── index.ts                   # 新增 Tab 类型
```

## 实现优先级

1. Store 重构（多 Tab 状态）
2. 持久化逻辑（storageService 扩展）
3. TabBar 组件
4. 数据迁移逻辑
5. VariableAutocomplete 组件
6. 集成测试

## 风险点

1. **状态复杂度增加** - 多 Tab 状态管理较复杂，需仔细处理切换时的保存/加载
2. **性能** - 大量 Tab 时需注意渲染性能，考虑虚拟化
3. **数据迁移** - 旧版本数据需平滑迁移，避免用户数据丢失

## 验收标准

- [ ] URL 输入框输入 `{{` 时弹出变量提示
- [ ] 变量提示支持键盘导航和过滤
- [ ] 可以新建、切换、关闭 Tab
- [ ] Tab 数据自动保存，重启后恢复
- [ ] 旧数据自动迁移
- [ ] 所有现有功能正常工作（History、curl 导入、变量替换等）
