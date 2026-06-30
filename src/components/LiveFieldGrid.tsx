import * as React from 'react';

export type LiveFieldItem = {
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
};

type LiveFieldGridProps = {
  className?: string;
  items: LiveFieldItem[];
};

const LiveFieldGrid: React.FC<LiveFieldGridProps> = ({ className, items }) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={className ? `ols-plugin__live-field-grid ${className}` : 'ols-plugin__live-field-grid'}>
      {items.map((item) => (
        <div className="ols-plugin__live-field-item" key={item.id}>
          <div className="ols-plugin__live-field-label">{item.label}</div>
          <div className="ols-plugin__live-field-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
};

export default LiveFieldGrid;
