# SimpleRequest 默认主题配色

项目默认使用 **深色主题（Dark Theme）**，风格类似 **Catppuccin Mocha**，定义在 `src/popup/popup.scss`。

## 主题色

| 用途 | CSS 变量 | 颜色值 | 说明 |
|------|----------|--------|------|
| 主色调 | `--primary-color` | `#7c3aed` | 紫色 (Violet) |
| 主色悬停 | `--primary-hover` | `#6d28d9` | 深紫 |
| 主色浅色 | `--primary-light` | `#a78bfa` | 浅紫 |
| 成功色 | `--success-color` | `#10b981` | 绿色 |
| 错误色 | `--error-color` | `#ef4444` | 红色 |
| 警告色 | `--warning-color` | `#f59e0b` | 橙色 |
| 信息色 | `--info-color` | `#3b82f6` | 蓝色 |

## 背景色

| 用途 | CSS 变量 | 颜色值 | 说明 |
|------|----------|--------|------|
| 背景主色 | `--bg-primary` | `#1e1e2e` | 深蓝灰 |
| 背景次色 | `--bg-secondary` | `#181825` | 更深蓝灰 |
| 背景三级 | `--bg-tertiary` | `#11111b` | 最深 |
| 悬停背景 | `--bg-hover` | `#313244` | 中灰 |
| 激活背景 | `--bg-active` | `#45475a` | 亮灰 |

## 文字色

| 用途 | CSS 变量 | 颜色值 | 说明 |
|------|----------|--------|------|
| 文字主色 | `--text-primary` | `#cdd6f4` | 浅灰白 |
| 文字次色 | `--text-secondary` | `#bac2de` | 灰白 |
| 文字弱色 | `--text-muted` | `#6c7086` | 暗灰 |
| 文字反色 | `--text-inverse` | `#1e1e2e` | 深色 |

## 边框与圆角

| 用途 | CSS 变量 | 值 |
|------|----------|----|
| 边框色 | `--border-color` | `#45475a` |
| 浅边框 | `--border-light` | `#313244` |
| 圆角 | `--border-radius` | `8px` |
| 大圆角 | `--border-radius-lg` | `12px` |

## 阴影

| 用途 | CSS 变量 | 值 |
|------|----------|----|
| 小阴影 | `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.3)` |
| 中阴影 | `--shadow-md` | `0 4px 6px rgba(0, 0, 0, 0.4)` |
| 大阴影 | `--shadow-lg` | `0 10px 15px rgba(0, 0, 0, 0.5)` |

## HTTP 方法颜色

| 方法 | CSS 变量 | 颜色值 |
|------|----------|--------|
| GET | `--method-get` | `#10b981` |
| POST | `--method-post` | `#f59e0b` |
| PUT | `--method-put` | `#3b82f6` |
| DELETE | `--method-delete` | `#ef4444` |
| PATCH | `--method-patch` | `#8b5cf6` |

## 备注

- 项目目前只有这一套深色主题，没有亮色主题
- 所有颜色通过 CSS 变量统一管理，方便后续扩展主题切换功能
