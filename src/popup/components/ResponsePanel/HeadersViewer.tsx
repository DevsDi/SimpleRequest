import React from 'react';
import './HeadersViewer.scss';

/**
 * Response headers viewer component
 * Displays HTTP response headers list
 */
interface HeadersViewerProps {
  /** Response headers object */
  headers: Record<string, string>;
}

const HeadersViewer: React.FC<HeadersViewerProps> = ({ headers }) => {
  const headerEntries = Object.entries(headers);

  if (headerEntries.length === 0) {
    return <div className="headers-viewer empty">No headers</div>;
  }

  return (
    <div className="headers-viewer">
      <table className="headers-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
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