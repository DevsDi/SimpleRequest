# Task 1: 添加 Tab 类型定义

## 文件
- Modify: `src/types/index.ts`

## 说明
在现有类型文件末尾添加 Tab 类型定义。

## 需要添加的代码

在 `src/types/index.ts` 文件末尾添加：

```typescript
/**
 * Tab 元数据
 */
export interface Tab {
  /** 唯一标识，与 HttpRequest.id 关联 */
  id: string;
  /** 显示名称（自动生成：method + URL 片段） */
  name: string;
  /** 创建时间 */
  createdAt: number;
}

/**
 * Tabs 数据存储结构
 */
export interface TabsData {
  /** Tab 元数据列表 */
  tabs: Tab[];
  /** Request 数据映射 (id -> HttpRequest) */
  requests: Record<string, HttpRequest>;
  /** Response 数据映射 (id -> HttpResponse | null) */
  responses: Record<string, HttpResponse | null>;
  /** 当前激活的 Tab ID */
  activeTabId: string | null;
}
```

## 完成标准
- 类型定义正确添加
- TypeScript 编译通过
- 提交代码
