import React, { useEffect, useRef, useCallback } from 'react';
import './ContextMenu.scss';

/**
 * Menu item interface definition
 */
export interface MenuItem {
  /** Menu item text */
  label: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Click callback */
  onClick: () => void;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether it is a dangerous action (red style) */
  danger?: boolean;
}

/**
 * ContextMenu component Props
 */
export interface ContextMenuProps {
  /** List of menu items */
  items: MenuItem[];
  /** Display position */
  position: { x: number; y: number };
  /** Close callback */
  onClose: () => void;
}

/**
 * Generic right-click menu component
 *
 * Features:
 * - Displays the menu at the given position
 * - Automatically detects boundaries and adjusts the position when it exceeds the viewport
 * - Supports closing via outside click, Esc key, or clicking a menu item
 * - Supports disabled items and danger styles
 */
const ContextMenu: React.FC<ContextMenuProps> = ({ items, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);
  // Track the clicked menu item index to show the click effect
  const [clickedIndex, setClickedIndex] = React.useState<number | null>(null);

  /**
   * Boundary detection: ensure the menu stays within the viewport
   */
  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newX = position.x;
    let newY = position.y;

    // Check the right boundary
    if (newX + menuRect.width > viewportWidth) {
      newX = viewportWidth - menuRect.width - 8; // Leave an 8px margin
    }

    // Check the bottom boundary
    if (newY + menuRect.height > viewportHeight) {
      newY = viewportHeight - menuRect.height - 8;
    }

    // Ensure the menu does not exceed the left and top boundaries
    newX = Math.max(8, newX);
    newY = Math.max(8, newY);

    setAdjustedPosition({ x: newX, y: newY });
  }, [position]);

  /**
   * Close the menu on Esc key
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
   * Close the menu on outside click
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use mousedown instead of click for faster response
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  /**
   * Handle menu item click
   * Use onMouseDown to prevent the Chrome extension popup from closing
   * Delay closing so the user can see the click feedback effect
   */
  const handleItemClick = useCallback((item: MenuItem, index: number) => (e: React.MouseEvent) => {
    // Stop event propagation
    e.stopPropagation();

    // Disabled items do not respond to clicks
    if (item.disabled) return;

    // Set the clicked state to show the pressed effect
    setClickedIndex(index);

    // Delay closing the menu so the user can see the click effect (150ms)
    setTimeout(() => {
      // Execute the click callback
      item.onClick();

      // Close the menu
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
