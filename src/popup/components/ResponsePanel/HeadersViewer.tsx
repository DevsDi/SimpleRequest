import React from 'react';
import './HeadersViewer.scss';

/**
 * 响应头查看器组件
 * 展示HTTP响应头列表
 */
interface HeadersViewerProps {
  /** 响应头对象 */
  headers: Record<string, string>;
}

const HeadersViewer: React.FC<HeadersViewerProps> = ({ headers }) => {
  const headerEntries = Object.entries(headers);

  if (headerEntries.length === 0) {
    return <div className="headers-viewer empty">响应头为空</div>;
  }

  return (
    <div className="headers-viewer">
      <table className="headers-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>值</th>
          </tr>
        </thead>
        <tbody>
          {headerEntries.map(([key, value]) => (
            <tr key={key}>
              <td className="header-name">{key}</td>
              <td className="header-value">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HeadersViewer;