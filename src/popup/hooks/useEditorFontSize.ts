import { useState, useEffect } from 'react';

/** 字体大小选项 */
export const FONT_SIZE_OPTIONS = [
  { label: 'S', value: 12, title: 'Small' },
  { label: 'M', value: 14, title: 'Medium' },
  { label: 'L', value: 16, title: 'Large' },
] as const;

export type FontSize = typeof FONT_SIZE_OPTIONS[number]['value'];

const STORAGE_KEY = 'editor-font-size';

/**
 * 自定义 hook：管理编辑器字体大小
 * 保存到 localStorage，页面刷新后保持
 */
export function useEditorFontSize(): [FontSize, (size: FontSize) => void] {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    // 从 localStorage 读取保存的字体大小
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const size = parseInt(saved, 10);
      if (FONT_SIZE_OPTIONS.some(opt => opt.value === size)) {
        return size as FontSize;
      }
    }
    return 14; // 默认 M
  });

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(fontSize));
  }, [fontSize]);

  return [fontSize, setFontSize];
}