import logo from "../assets/logo.png";
import { useTranslation } from 'react-i18next';

export function About() {
  const { t } = useTranslation();

  const containerStyle = {
    flex: 1,
    overflowY: 'auto' as const,
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    padding: '40px 20px',
  };

  const contentStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  const headerStyle = {
    textAlign: 'center' as const,
    marginBottom: '60px',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '40px'
  };

  const titleStyle = {
    fontSize: '48px',
    fontWeight: 'bold',
    margin: '0 0 10px 0',
    color: '#f8fafc'
  };

  const subtitleStyle = {
    fontSize: '24px',
    color: '#94a3b8',
    margin: 0
  };

  const sectionStyle = {
    marginBottom: '40px'
  };

  const h2Style = {
    fontSize: '28px',
    color: '#38bdf8',
    marginBottom: '20px',
    borderBottom: '1px solid #1e293b',
    paddingBottom: '10px'
  };

  const h3Style = {
    fontSize: '20px',
    color: '#f8fafc',
    marginTop: '24px',
    marginBottom: '12px'
  };

  const pStyle = {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#cbd5e1',
    marginBottom: '16px'
  };

  const badgeStyle = (color: string) => ({
    display: 'inline-block',
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '12px',
    backgroundColor: `${color}20`,
    color: color,
    border: `1px solid ${color}40`,
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
    marginLeft: '12px',
    verticalAlign: 'middle'
  });

  return (
    <div className="about-container" style={{...containerStyle, minHeight: 0}}>
      <div style={contentStyle}>
        
        <header style={headerStyle}>
          <img src={logo} className="about-logo" alt="GeoResponde Logo" style={{ height: 'auto', maxHeight: '192px', marginBottom: '16px' }} />
          <h1 style={titleStyle}>{t('about.title')}</h1>
          <p style={subtitleStyle}>{t('about.subtitle')}</p>
        </header>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.mission.title')}</h2>
          <p style={pStyle}>
            {t('about.mission.p1')}
          </p>
          <p style={pStyle}>
            {t('about.mission.p2')}
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.whyExists.title')}</h2>
          <p style={pStyle}>{t('about.whyExists.p1')}</p>
          <p style={pStyle}>{t('about.whyExists.p2')}</p>
          <p style={pStyle}>{t('about.whyExists.p3')}</p>
          <p style={pStyle}>{t('about.whyExists.p4')}</p>
          <p style={pStyle}><strong>{t('about.whyExists.p5')}</strong></p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.howItWorks.title')}</h2>
          <p style={pStyle}>{t('about.howItWorks.p1')}</p>
          
          <h3 style={h3Style}>1. {t('about.howItWorks.pillar1')} <span style={{color: '#94a3b8', fontWeight: 'normal'}}>{t('about.howItWorks.pillar1sub')}</span></h3>
          <ul style={{...pStyle, paddingLeft: '20px'}}>
            <li>{t('about.howItWorks.p1_1')}</li>
            <li>{t('about.howItWorks.p1_2')}</li>
            <li>{t('about.howItWorks.p1_3')}</li>
            <li>{t('about.howItWorks.p1_4')}</li>
          </ul>

          <h3 style={h3Style}>2. {t('about.howItWorks.pillar2')} <span style={{color: '#94a3b8', fontWeight: 'normal'}}>{t('about.howItWorks.pillar2sub')}</span></h3>
          <ul style={{...pStyle, paddingLeft: '20px'}}>
            <li>{t('about.howItWorks.p2_1')}</li>
            <li>{t('about.howItWorks.p2_2')}</li>
            <li>{t('about.howItWorks.p2_3')}</li>
            <li>{t('about.howItWorks.p2_4')}</li>
            <li>{t('about.howItWorks.p2_5')}</li>
          </ul>

          <h3 style={h3Style}>3. {t('about.howItWorks.pillar3')} <span style={{color: '#94a3b8', fontWeight: 'normal'}}>{t('about.howItWorks.pillar3sub')}</span></h3>
          <ul style={{...pStyle, paddingLeft: '20px'}}>
            <li>{t('about.howItWorks.p3_1')}</li>
            <li><em>{t('about.howItWorks.p3_2')}</em></li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.openSource.title')}</h2>
          <p style={pStyle}>
            {t('about.openSource.p1')}
          </p>
          <p style={pStyle}>
            {t('about.openSource.p2')}
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.status.title')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{t('about.status.situation')}</span>
            <div><span style={badgeStyle('#3b82f6')}>{t('about.status.beta')}</span></div>
            
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{t('about.status.find')}</span>
            <div><span style={badgeStyle('#f59e0b')}>{t('about.status.experimental')}</span></div>
            
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{t('about.status.report')}</span>
            <div><span style={badgeStyle('#64748b')}>{t('about.status.inDev')}</span></div>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.developedBy.title')}</h2>
          <p style={pStyle}>
            <strong>{t('about.developedBy.contributors')}</strong>
          </p>
          <p style={pStyle}>
            {t('about.developedBy.author')}<br />
            {t('about.developedBy.community')}
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.principles.title')}</h2>
          <ul style={{...pStyle, paddingLeft: '20px'}}>
            <li style={{marginBottom: '10px'}}><strong>{t('about.principles.p1_title')}</strong> {t('about.principles.p1_text')}</li>
            <li style={{marginBottom: '10px'}}><strong>{t('about.principles.p2_title')}</strong> {t('about.principles.p2_text')}</li>
            <li style={{marginBottom: '10px'}}><strong>{t('about.principles.p3_title')}</strong> {t('about.principles.p3_text')}</li>
            <li style={{marginBottom: '10px'}}><strong>{t('about.principles.p4_title')}</strong> {t('about.principles.p4_text')}</li>
            <li style={{marginBottom: '10px'}}><strong>{t('about.principles.p5_title')}</strong> {t('about.principles.p5_text')}</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.disclaimer.title')}</h2>
          <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
            <p style={{...pStyle, marginTop: 0}}>{t('about.disclaimer.p1')}</p>
            <p style={pStyle}>{t('about.disclaimer.p2')}</p>
            <p style={pStyle}>{t('about.disclaimer.p3')}</p>
            <p style={{...pStyle, marginBottom: 0}}><strong>{t('about.disclaimer.p4')}</strong></p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{t('about.philosophy.title')}</h2>
          <p style={pStyle}>{t('about.philosophy.subtitle')}</p>
          <ul style={{...pStyle, paddingLeft: '20px'}}>
            <li>{t('about.philosophy.li1')}</li>
            <li>{t('about.philosophy.li2')}</li>
            <li>{t('about.philosophy.li3')}</li>
            <li>{t('about.philosophy.li4')}</li>
            <li>{t('about.philosophy.li5')}</li>
          </ul>
        </section>
        
      </div>
    </div>
  );
}
