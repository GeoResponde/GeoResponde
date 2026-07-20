import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const containerStyle = {
    flex: 1,
    overflowY: 'auto' as const,
    backgroundColor: '#0f172a', // slate-900
    color: '#e2e8f0', // slate-200
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  };

  const heroStyle = {
    position: 'relative' as const,
    padding: '80px 20px',
    textAlign: 'center' as const,
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    borderBottom: '1px solid #334155',
  };

  const logoStyle = {
    height: '140px',
    marginBottom: '24px',
    filter: 'drop-shadow(0 0 20px rgba(56, 189, 248, 0.2))',
  };

  const titleStyle = {
    fontSize: '56px',
    fontWeight: '800',
    color: '#f8fafc',
    margin: '0 0 16px 0',
    letterSpacing: '-1px',
  };

  const subtitleStyle = {
    fontSize: '22px',
    color: '#94a3b8',
    maxWidth: '800px',
    margin: '0 auto 32px auto',
    lineHeight: '1.6',
  };

  const missionBoxStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#1e293b',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #334155',
    fontSize: '18px',
    lineHeight: '1.6',
    color: '#cbd5e1',
  };

  const pillarsContainerStyle = {
    maxWidth: '1200px',
    margin: '60px auto',
    padding: '0 20px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '24px',
  };

  const cardStyle = {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '32px',
    border: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column' as const,
    transition: 'transform 0.2s ease, border-color 0.2s ease',
  };

  const cardTitleStyle = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const cardDescStyle = {
    fontSize: '16px',
    color: '#94a3b8',
    lineHeight: '1.6',
    flex: 1,
    marginBottom: '32px',
  };

  const btnPrimary = {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#38bdf8',
    color: '#0f172a',
    fontWeight: '700',
    borderRadius: '8px',
    textDecoration: 'none',
    textAlign: 'center' as const,
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background-color 0.2s ease',
  };

  const btnSecondary = {
    ...btnPrimary,
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  };

  const btnDisabled = {
    ...btnPrimary,
    backgroundColor: '#475569',
    color: '#94a3b8',
    cursor: 'not-allowed',
  };

  const inDevBadge = {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#f59e0b20',
    color: '#f59e0b',
    borderRadius: '12px',
    border: '1px solid #f59e0b40',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    display: 'inline-block',
    marginBottom: '16px',
  };

  const aboutSectionStyle = {
    maxWidth: '800px',
    margin: '60px auto',
    padding: '0 20px',
  };

  const h2Style = {
    fontSize: '32px',
    color: '#38bdf8',
    marginBottom: '24px',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '12px',
  };

  const pStyle = {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#cbd5e1',
    marginBottom: '16px',
  };

  const githubLinkStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 32px',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontWeight: '700',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '18px',
    marginTop: '24px',
  };

  return (
    <div style={containerStyle}>
      {/* HERO SECTION */}
      <section style={heroStyle}>
        <img src={logo} alt="GeoResponde Logo" style={logoStyle} />
        <h1 style={titleStyle}>{t('landing.heroTitle')}</h1>
        <p style={subtitleStyle}>{t('landing.heroSubtitle')}</p>
        
        <div style={missionBoxStyle}>
          {t('landing.mission')}
        </div>
      </section>

      {/* 3 PILLARS SECTION */}
      <section style={pillarsContainerStyle}>
        
        {/* Pillar 1: Situation */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>
            <span style={{ fontSize: '28px' }}>🌍</span>
            {t('landing.pillars.situation.title')}
          </h2>
          <p style={cardDescStyle}>{t('landing.pillars.situation.description')}</p>
          <button 
            style={btnPrimary}
            onClick={() => navigate('/situation')}
          >
            {t('landing.pillars.situation.cta')}
          </button>
        </div>

        {/* Pillar 2: Find */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>
            <span style={{ fontSize: '28px' }}>🔍</span>
            {t('landing.pillars.find.title')}
          </h2>
          <p style={cardDescStyle}>{t('landing.pillars.find.description')}</p>
          <button 
            style={btnSecondary}
            onClick={() => navigate('/find')}
          >
            {t('landing.pillars.find.cta')}
          </button>
        </div>

        {/* Pillar 3: Report */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>
            <span style={{ fontSize: '28px' }}>📝</span>
            {t('landing.pillars.report.title')}
          </h2>
          <div><span style={inDevBadge}>{t('landing.pillars.report.inDevelopment')}</span></div>
          <p style={cardDescStyle}>{t('landing.pillars.report.description')}</p>
          <button style={btnDisabled} disabled>
            {t('landing.pillars.report.cta')}
          </button>
        </div>

      </section>

      {/* ABOUT / OPEN SOURCE SECTION */}
      <section style={aboutSectionStyle}>
        <h2 style={h2Style}>{t('landing.sections.whyExists')}</h2>
        <p style={pStyle}>{t('about.whyExists.p1')}</p>
        <p style={pStyle}>{t('about.whyExists.p2')} {t('about.whyExists.p3')}</p>
        <p style={pStyle}>{t('about.whyExists.p4')}</p>
        <p style={pStyle}><strong>{t('about.whyExists.p5')}</strong></p>

        <h2 style={h2Style}>{t('landing.sections.openSource')} & {t('landing.sections.developedBy')}</h2>
        <p style={pStyle}>{t('about.openSource.p1')}</p>
        <p style={pStyle}>{t('about.openSource.p2')}</p>
        <p style={pStyle}>{t('about.developedBy.author')} {t('about.developedBy.community')}</p>
        
        <div style={{ textAlign: 'center', margin: '40px 0' }}>
          <a href="https://github.com/GeoResponde/GeoResponde" target="_blank" rel="noopener noreferrer" style={githubLinkStyle}>
            <svg height="24" width="24" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            {t('landing.githubLink')}
          </a>
        </div>

        <h2 style={h2Style}>{t('landing.sections.disclaimer')}</h2>
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
          <p style={{...pStyle, marginTop: 0}}>{t('about.disclaimer.p1')}</p>
          <p style={pStyle}>{t('about.disclaimer.p2')}</p>
          <p style={{...pStyle, marginBottom: 0}}><strong>{t('about.disclaimer.p4')}</strong></p>
        </div>
      </section>

      <footer style={{ textAlign: 'center', padding: '40px 20px', borderTop: '1px solid #1e293b', color: '#64748b', marginTop: '40px' }}>
        <p>© 2026 GeoResponde. {t('about.openSource.p1').split(' ')[0]} Open Source.</p>
      </footer>
    </div>
  );
}
