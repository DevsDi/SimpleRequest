import { useState, useEffect } from 'react';

/** Font size options */
export const FONT_SIZE_OPTIONS = [
  { label: 'S', value: 12, title: 'Small' },
  { label: 'M', value: 14, title: 'Medium' },
  { label: 'L', value: 16, title: 'Large' },
] as const;

export type FontSize = typeof FONT_SIZE_OPTIONS[number]['value'];

const STORAGE_KEY = 'editor-font-size';

/**
 * Custom hook: manage the editor font size
 * Persisted to localStorage, preserved across page reloads
 */
export function useEditorFontSize(): [FontSize, (size: FontSize) => void] {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    // Read the saved font size from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const size = parseInt(saved, 10);
      if (FONT_SIZE_OPTIONS.some(opt => opt.value === size)) {
        return size as FontSize;
      }
    }
    return 14; // default M
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(fontSize));
  }, [fontSize]);

  return [fontSize, setFontSize];
}