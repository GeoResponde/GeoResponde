
export function Footer() {
  return (
    <footer className="footer-links" style={{
      backgroundColor: '#0f172a',
      borderTop: '1px solid #1e293b',
      padding: '24px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      color: '#94a3b8',
      fontSize: '12px',
      position: 'relative',
      zIndex: 1000,
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontWeight: 'bold', color: '#cbd5e1', fontSize: '14px' }}>GeoResponde</div>
        <div style={{ color: '#94a3b8' }}>Open-source Geospatial Situation Room</div>
        <div style={{ color: '#64748b', marginTop: '4px' }}>&copy; {new Date().getFullYear()} GeoResponde Contributors</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: '8px', color: '#94a3b8' }}>
          <a href="https://github.com/georesponde/georesponde" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>GitHub</a>
          <span>&middot;</span>
          <a href="#" style={{ color: '#94a3b8', textDecoration: 'none' }}>Documentation</a>
          <span>&middot;</span>
          <a href="https://github.com/GeoResponde/GeoResponde/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>License</a>
        </div>
        <div style={{ color: '#64748b', fontWeight: 'bold' }}>v0.2.0-alpha</div>
      </div>
    </footer>
  );
}
