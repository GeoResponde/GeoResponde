/* reducción de padding, flexbox row, alineaciones, responsividad,*/
export function Footer() {
  return (
    <footer className="footer-links" style={{
      backgroundColor: '#0f172a',
      borderTop: '1px solid #1e293b',
      padding: '6px 16px', 
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center', 
      color: '#94a3b8',
      fontSize: '8px', 
      position: 'relative',
      zIndex: 1000,
      flexShrink: 0,
      flexWrap: 'wrap',
      gap: '8px 12px'
    }}>
      {/* Bloque Izquierdo: Identificación del proyecto */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 'bold', color: '#cbd5e1' }}>GeoResponde</span>
        <span style={{ color: '#334155' }}>|</span>
        <span>Open-source Geospatial Situation Room</span>
        <span style={{ color: '#334155' }}>|</span>
        {/*<span style={{ color: '#64748b' }}>&copy; {new Date().getFullYear()} Contributors</span>*/}
      </div>

      {/* Bloque Derecho: Enlaces de interés y versión */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href="https://github.com/georesponde/georesponde" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>GitHub</a>
          <span style={{ color: '#64748b' }}>&middot;</span>
          <a href="#" style={{ color: '#94a3b8', textDecoration: 'none' }}>Documentation</a>
          <span style={{ color: '#64748b' }}>&middot;</span>
          <a href="https://github.com/GeoResponde/GeoResponde/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" style={{ color: '#94a3b8', textDecoration: 'none' }}>License</a>
        </div>
        <span style={{ color: '#334155' }}>|</span>
        <div style={{ color: '#64748b', fontWeight: 'bold' }}>v0.5.0-alpha</div>
      </div>
    </footer>
  );
}