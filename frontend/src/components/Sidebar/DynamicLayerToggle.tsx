import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  label: string;
  description?: string;
  /** Source badge label (e.g. "NASA EONET", "Venezuela Reporta"). */
  badge?: string;
  active: boolean;
  onToggle: () => void;
  /** Filters/controls revealed in an expandable section when the layer is on. */
  children?: ReactNode;
}

/**
 * A Sidebar toggle row for a dynamic (non-catalog) situation source — EONET
 * events or Venezuela Reporta aid sites. Reuses the catalog `.layer-item`
 * styling so dynamic sources read as first-class layers, and reveals their
 * filters in an expandable section under the toggle when active.
 */
export function DynamicLayerToggle({
  icon: Icon,
  label,
  description,
  badge,
  active,
  onToggle,
  children,
}: Props) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div
        className={`layer-item ${active ? 'active' : ''}`}
        onClick={onToggle}
        role="button"
        aria-pressed={active}
      >
        <Icon className="layer-icon" size={20} />
        <div className="layer-info">
          <div className="layer-name">{label}</div>
          {description && (
            <div
              className="layer-description"
              style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginTop: '2px',
                marginBottom: '4px',
                lineHeight: '1.2',
              }}
            >
              {description}
            </div>
          )}
          {badge && (
            <div className="layer-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="layer-badge">{badge}</span>
            </div>
          )}
        </div>
      </div>
      {active && children && (
        <div
          style={{
            marginTop: '8px',
            marginLeft: '8px',
            paddingLeft: '12px',
            borderLeft: '2px solid #334155',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
