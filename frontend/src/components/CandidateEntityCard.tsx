import { useState, type ReactNode } from 'react';
import type { CandidateEntity, PersonStatus } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';

// Translations are fetched inside the component now

function Chip({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        backgroundColor: color ? `${color}22` : '#0f172a',
        color: color || '#94a3b8',
        border: `1px solid ${color || '#334155'}`,
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

export function CandidateEntityCard({ candidate }: { candidate: CandidateEntity }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const primaryObs = candidate.observations[0];
  if (!primaryObs) return null;
  const primaryFields = primaryObs.normalizedFields;
  const person = primaryFields.person;

  const getStatusColor = (status: PersonStatus) => {
    switch (status) {
      case 'missing': return '#ef4444';
      case 'found': return '#22c55e';
      case 'hospitalized': return '#f59e0b';
      case 'safe': return '#3b82f6';
      case 'deceased': return '#6b7280';
      case 'unknown': return '#64748b';
      default: return '#64748b';
    }
  };

  const status = person?.status ? { label: t(`find.card.statusMeta.${person.status}`), color: getStatusColor(person.status) } : undefined;
  const gender = person?.gender ? t(`find.card.gender.${person.gender}`) : '';

  // Determine if there are conflicting statuses
  const statuses = new Set(
    candidate.observations
      .map((obs) => obs.normalizedFields.person?.status)
      .filter(Boolean)
  );
  const hasConflict = statuses.size > 1;

  return (
    <div className="search-result-card" style={{ border: candidate.confidence === 'HIGH' ? '1px solid #22c55e' : undefined }}>
      <div className="search-result-info">
        <h3 className="search-result-title">{primaryFields.title}</h3>
        <p className="search-result-subtitle">{primaryFields.subtitle}</p>
        
        {person && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {status && <Chip color={status.color}>{status.label}</Chip>}
            {person.cedula && <Chip>CI: {person.cedula}</Chip>}
            {typeof person.age === 'number' && <Chip>{person.age} años</Chip>}
            {gender && <Chip>{gender}</Chip>}
            {person.hospital && <Chip>{person.hospital}</Chip>}
            {person.verified && <Chip color="#22c55e">{t('find.card.verified')}</Chip>}
            {person.isMinor && <Chip color="#f59e0b">{t('find.card.minor')}</Chip>}
          </div>
        )}

        {candidate.confidence === 'HIGH' && !hasConflict && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 'bold' }}>{t('find.card.highConfidence')}</span>
          </div>
        )}

        {hasConflict && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }}>{t('find.card.conflict')}</span>
          </div>
        )}

        <div className="search-result-metadata">
           <span className="search-result-type-badge">
             {t('find.type')}: {candidate.entityType}
           </span>
           <span className="search-result-source">
             {candidate.observations.length} {t(candidate.observations.length === 1 ? 'find.card.report_one' : 'find.card.report_other')}
           </span>
        </div>

        {candidate.observations.length > 1 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{ marginTop: '12px', background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', fontSize: '14px', padding: 0 }}
          >
            {expanded ? t('find.card.hideReports') : t('find.card.showReports', { count: candidate.observations.length })}
          </button>
        )}

        {expanded && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', borderLeft: '2px solid #334155' }}>
            {candidate.observations.map((obs) => {
              const obsStatus = obs.normalizedFields.person?.status;
              const meta = obsStatus ? { label: t(`find.card.statusMeta.${obsStatus}`), color: getStatusColor(obsStatus) } : undefined;
              return (
                <div key={obs.id} style={{ background: '#0f172a', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('find.card.source')}{obs.provider}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {obs.observedAt ? new Date(obs.observedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {meta && (
                    <div style={{ fontSize: '12px', color: meta.color, marginBottom: '8px', fontWeight: 'bold' }}>
                      {t('find.card.status')}{meta.label}
                    </div>
                  )}
                  {obs.normalizedFields.person?.hospital && (
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>
                      {t('find.card.location')}{obs.normalizedFields.person.hospital}
                    </div>
                  )}
                  <a href={obs.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#3498db', textDecoration: 'none' }}>
                    {t('find.card.openOriginal')}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!expanded && candidate.observations.length === 1 && (
        <div className="search-result-action">
          <a 
            href={primaryFields.url} 
            target="_blank" 
            rel="noreferrer"
            className="search-result-button"
          >
            {t('find.openResource')}
          </a>
        </div>
      )}
    </div>
  );
}
