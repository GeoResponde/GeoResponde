import { useState, type ReactNode } from 'react';
import type { UnifiedSearchResource, PersonStatus } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';

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

export function ResourceCard({ resource }: { resource: UnifiedSearchResource }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const isCandidate = !!resource.candidate;
  let observations: any[] = [];
  
  if (isCandidate && resource.candidate && Array.isArray(resource.candidate.observations)) {
    observations = resource.candidate.observations.map(o => ({
      ...(o.normalizedFields || {}),
      provider: o.provider || 'unknown',
      observedAt: o.observedAt,
      sourceUrl: o.sourceUrl
    }));
  } else if (resource.result) {
    observations = [{
      ...resource.result,
      provider: resource.result.provider_id || resource.result.provider || 'unknown',
      observedAt: resource.result.last_update,
      sourceUrl: resource.result.url
    }];
  }

  if (observations.length === 0) {
    return (
      <div className="search-result-card" style={{ border: '2px solid red', padding: '16px' }}>
        <h3 className="search-result-title">Error: Empty Resource</h3>
        <p style={{ color: '#fff' }}>The resource has no candidate observations and no result fallback.</p>
        <pre style={{ color: '#fff', fontSize: '10px', overflow: 'auto' }}>
          {JSON.stringify(resource, null, 2)}
        </pre>
      </div>
    );
  }

  const primaryFields = observations[0] || {};
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

  const isHighConfidence = isCandidate && resource.candidate?.confidence === 'HIGH';
  const conflicts = resource.candidate?.conflicts || [];
  const relatedObservations = resource.candidate?.relatedObservations || [];
  const hasConflict = conflicts.length > 0;

  return (
    <div className="search-result-card" style={{ border: isHighConfidence ? '1px solid #22c55e' : undefined }}>
      <div className="search-result-info">
        <h3 className="search-result-title">{primaryFields.title}</h3>
        <p className="search-result-subtitle">{primaryFields.subtitle}</p>
        
        {person && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {status && <Chip color={status.color}>{status.label}</Chip>}
            {person.cedula && <Chip>CI: {person.cedula}</Chip>}
            {typeof person.age === 'number' && <Chip>{person.age} {t('find.card.ageSuffix', 'años')}</Chip>}
            {gender && <Chip>{gender}</Chip>}
            {person.hospital && <Chip>{person.hospital}</Chip>}
            {person.verified && <Chip color="#22c55e">{t('find.card.verified')}</Chip>}
            {person.isMinor && <Chip color="#f59e0b">{t('find.card.minor')}</Chip>}
          </div>
        )}

        {isHighConfidence && !hasConflict && (
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#22c55e', fontSize: '12px', fontWeight: 'bold' }}>{t('find.card.highConfidence')}</span>
          </div>
        )}

        {hasConflict && (
          <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#451a03', borderLeft: '4px solid #f59e0b', borderRadius: '4px' }}>
            <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
              ⚠️ {t('find.card.discrepanciesDetected', 'Discrepancies Detected')}
            </div>
            <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '11px', color: '#fcd34d' }}>
              {conflicts.map((c, i) => (
                <li key={i}>
                  <strong>{t(`find.fields.${c.field}`, c.field)}</strong>:{' '}
                  {c.observations.map(o => `${String(o.value)} (${o.provider})`).join(' vs ')}
                </li>
              ))}
            </ul>
          </div>
        )}

        {relatedObservations.length > 0 && (
          <div style={{ marginBottom: '8px', padding: '8px', backgroundColor: '#1e1b4b', borderLeft: '4px solid #818cf8', borderRadius: '4px' }}>
            <div style={{ color: '#818cf8', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
              🔗 {t('find.card.relatedMatches', 'Possible related matches')}
            </div>
            <ul style={{ margin: '0 0 0 16px', padding: 0, fontSize: '11px', color: '#c7d2fe' }}>
              {relatedObservations.map((r, i) => {
                const translatedReasons = r.reasons.map((reason: string) => {
                  if (reason.startsWith('Name similarity:')) {
                    const pct = reason.split(': ')[1];
                    return `${t('find.reasons.nameSimilarity', 'Name similarity')}: ${pct}`;
                  }
                  // Normalizes the reason to camelCase for key lookup (e.g. "Differing locations" -> "differingLocations")
                  const key = reason.split(' ').map((w, idx) => idx === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
                  return t(`find.reasons.${key}`, reason);
                });
                return (
                  <li key={i}>
                    {t('find.card.matchConfidence', 'Match confidence')} {Math.round(r.confidence * 100)}% ({translatedReasons.join(', ')})
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {resource.rankingExplanations?.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
            {resource.rankingExplanations.map((exp, i) => {
              let label = t(`find.signals.${exp.signal}`, exp.explanation);
              if (exp.signal === 'CorroborationSignal') {
                label = t('find.signals.CorroborationSignal', { count: exp.debugMetadata?.totalSources || 2 });
              } else if (exp.signal === 'ProviderWeightSignal') {
                label = t('find.signals.ProviderWeightSignal', { provider: exp.debugMetadata?.bestProvider || 'unknown' });
              } else if (exp.signal === 'ExactMatchSignal') {
                if (exp.explanation === 'Exact match') label = t('find.signals.ExactMatchSignal_exact');
                else if (exp.explanation === 'Contains all search terms') label = t('find.signals.ExactMatchSignal_all');
                else label = t('find.signals.ExactMatchSignal_partial');
              }
              return (
                <span key={i} style={{ fontSize: '11px', padding: '2px 6px', background: '#334155', color: '#cbd5e1', borderRadius: '4px' }}>
                  ✓ {label}
                </span>
              );
            })}
          </div>
        )}

        <div className="search-result-metadata">
           <span className="search-result-type-badge">
             {t('find.type')}: {t(`find.entityType.${resource.entityType}`, resource.entityType)}
           </span>
           <span className="search-result-source">
             {observations.length} {t(observations.length === 1 ? 'find.card.report_one' : 'find.card.report_other')}
           </span>
        </div>

        {observations.length > 1 && (
          <button 
            onClick={() => setExpanded(!expanded)}
            style={{ marginTop: '12px', background: 'none', border: 'none', color: '#3498db', cursor: 'pointer', fontSize: '14px', padding: 0 }}
          >
            {expanded ? t('find.card.hideReports') : t('find.card.showReports', { count: observations.length })}
          </button>
        )}

        {expanded && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', borderLeft: '2px solid #334155' }}>
            {observations.map((obs, idx) => {
              const obsStatus = obs.person?.status;
              const meta = obsStatus ? { label: t(`find.card.statusMeta.${obsStatus}`), color: getStatusColor(obsStatus) } : undefined;
              return (
                <div key={idx} style={{ background: '#0f172a', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t('find.card.source')} {obs.provider}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {obs.observedAt ? new Date(obs.observedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {meta && (
                    <div style={{ fontSize: '12px', color: meta.color, marginBottom: '8px', fontWeight: 'bold' }}>
                      {t('find.card.status')} {meta.label}
                    </div>
                  )}
                  {obs.person?.hospital && (
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>
                      {t('find.card.location')} {obs.person.hospital}
                    </div>
                  )}
                  <a href={obs.sourceUrl || obs.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#3498db', textDecoration: 'none' }}>
                    {t('find.card.openOriginal')}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!expanded && observations.length === 1 && (
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
