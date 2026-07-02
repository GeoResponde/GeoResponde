import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoUrl from '../../assets/logo.png';

export function TopNav() {
  const { t, i18n } = useTranslation();

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: '12px 24px',
    color: isActive ? '#38bdf8' : '#cbd5e1',
    textDecoration: 'none',
    fontWeight: 'bold' as const,
    borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  });

  const badgeStyle = (color: string) => ({
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '12px',
    backgroundColor: `${color}20`,
    color: color,
    border: `1px solid ${color}40`,
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  });

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav style={{ 
      display: 'flex', 
      justifyContent: 'space-between',
      backgroundColor: '#0f172a',
      borderBottom: '1px solid #1e293b',
      padding: '0 20px',
      position: 'relative',
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px 0 0', borderRight: '1px solid #1e293b', marginRight: '10px' }}>
          <img src={logoUrl} alt="GeoResponde Logo" style={{ height: '32px' }} />
        </div>
        
        {/* Desktop Links */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center' }}>
          <NavLink to="/situation" style={linkStyle}>
            {t('nav.situation')}
            <span style={badgeStyle('#3b82f6')}>Beta</span>
          </NavLink>
          <NavLink to="/find" style={linkStyle}>
            {t('nav.find')}
            <span style={badgeStyle('#f59e0b')}>Experimental</span>
          </NavLink>
          <NavLink to="/report" style={linkStyle}>
            {t('nav.report')}
            <span style={badgeStyle('#64748b')}>In Dev</span>
          </NavLink>
          <NavLink to="/about" style={linkStyle}>
            {t('nav.about')}
          </NavLink>
        </div>
      </div>
      
      {/* Desktop Language Selector */}
      <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontWeight: 'bold' }}>
        <span 
          onClick={() => i18n.changeLanguage('es')}
          style={{ cursor: 'pointer', color: i18n.language.startsWith('es') ? '#38bdf8' : '#cbd5e1' }}
        >ES</span>
        <span>|</span>
        <span 
          onClick={() => i18n.changeLanguage('en')}
          style={{ cursor: 'pointer', color: i18n.language.startsWith('en') ? '#38bdf8' : '#cbd5e1' }}
        >EN</span>
      </div>

      {/* Mobile Hamburger Toggle */}
      <div className="mobile-nav-toggle" style={{ display: 'flex', alignItems: 'center' }}>
        <button 
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer' }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="mobile-menu-open" onClick={() => setMenuOpen(false)}>
          <NavLink to="/situation" style={linkStyle}>
            {t('nav.situation')}
            <span style={badgeStyle('#3b82f6')}>Beta</span>
          </NavLink>
          <NavLink to="/find" style={linkStyle}>
            {t('nav.find')}
            <span style={badgeStyle('#f59e0b')}>Experimental</span>
          </NavLink>
          <NavLink to="/report" style={linkStyle}>
            {t('nav.report')}
            <span style={badgeStyle('#64748b')}>In Dev</span>
          </NavLink>
          <NavLink to="/about" style={linkStyle}>
            {t('nav.about')}
          </NavLink>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#cbd5e1', fontWeight: 'bold', padding: '12px 24px' }}>
            <span 
              onClick={() => i18n.changeLanguage('es')}
              style={{ cursor: 'pointer', color: i18n.language.startsWith('es') ? '#38bdf8' : '#cbd5e1' }}
            >ES</span>
            <span>|</span>
            <span 
              onClick={() => i18n.changeLanguage('en')}
              style={{ cursor: 'pointer', color: i18n.language.startsWith('en') ? '#38bdf8' : '#cbd5e1' }}
            >EN</span>
          </div>
        </div>
      )}
    </nav>
  );
}
