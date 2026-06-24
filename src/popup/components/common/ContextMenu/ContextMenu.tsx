import React, { useEffect, useRef, useCallback } from 'react';
import './ContextMenu.scss';

/**
 * 菜单项接口定义
 */
export interface MenuItem {
  /** 菜单项文本 */
  label: string;
  /** 可选图标 */
  icon?: React.ReactNode;
  /** 点击回调 */
  onClick: () => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否为危险操作（红色样式） */
  danger?: boolean;
}

/**
 * ContextMenu 组件 Props
 */
export interface ContextMenuProps {
  /** 菜单项列表 */
  items: MenuItem[];
  /** 显示位置 */
  position: { x: number; y: number };
  /** 关闭回调 */
  onClose: () => void;
}

/**
 * 通用右键菜单组件
 *
 * 功能：
 * - 根据传入位置显示菜单
 * - 自动边界检测，超出视口时调整位置
 * - 支持点击外部、ESC键、点击菜单项关闭
 * - 支持禁用项和危险操作样式
 */
const ContextMenu: React.FC<ContextMenuProps> = ({ items, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);
  // 追踪点击的菜单项索引，用于显示点击效果
  const [clickedIndex, setClickedIndex] = React.useState<number | null>(null);

  /**
   * 边界检测：确保菜单不超出视口
   */
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newX = position.x;
    let newY = position.y;

    // 检查右边界
    if (newX + menuRect.width > viewportWidth) {
      newX = viewportWidth - menuRect.width - 8; // 留 8px 边距
    }

    // 检查下边界
    if (newY + menuRect.height > viewportHeight) {
      newY = viewportHeight - menuRect.height - 8;
    }

    // 确保不超出左边界和上边界
    newX = Math.max(8, newX);
    newY = Math.max(8, newY);

    setAdjustedPosition({ x: newX, y: newY });
  }, [position]);

  /**
   * ESC 键关闭菜单
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  /**
   * 点击外部关闭菜单
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 使用 mousedown 而非 click，响应更快
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  /**
   * 处理菜单项点击
   * 使用 onMouseDown 防止 Chrome 扩展 popup 关闭
   * 延迟关闭让用户能看到点击反馈效果
   */
  const handleItemClick = useCallback((item: MenuItem, index: number) => (e: React.MouseEvent) => {
    // 阻止事件冒泡
    e.stopPropagation();

    // 禁用项不响应点击
    if (item.disabled) return;

    // 设置点击状态，显示按下效果
    setClickedIndex(index);

    // 延迟关闭菜单，让用户看到点击效果（150ms）
    setTimeout(() => {
      // 执行点击回调
      item.onClick();

      // 关闭菜单
      onClose();
    }, 150);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''} ${clickedIndex === index ? 'clicked' : ''}`}
          onMouseDown={handleItemClick(item, index)}
        >
          {item.icon && <span className="menu-icon">{item.icon}</span>}
          <span className="menu-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;
