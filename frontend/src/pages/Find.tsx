import { useState, type ReactNode } from 'react';
import type { NormalizedSearchResult, PersonStatus, Gender } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';
import { FindMap } from '../components/Map/FindMap';
import { API_BASE } from '../lib/api';
import { shouldShowNoResults } from '../lib/searchState';

const STATUS_META: Record<PersonStatus, { label: string; color: string }> = {
  missing: { label: 'Desaparecido', color: '#ef4444' },
  found: { label: 'Encontrado', color: '#22c55e' },
  hospitalized: { label: 'Hospitalizado', color: '#f59e0b' },
  safe: { label: 'A salvo', color: '#3b82f6' },
  deceased: { label: 'Fallecido', color: '#6b7280' },
  unknown: { label: 'Sin estado', color: '#64748b' },
};

const GENDER_LABEL: Record<Gender, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
  unknown: '',
};

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

function PersonChips({ person }: { person: NonNullable<NormalizedSearchResult['person']> }) {
  const status = person.status ? STATUS_META[person.status] : undefined;
  const gender = person.gender ? GENDER_LABEL[person.gender] : '';
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
      {status && <Chip color={status.color}>{status.label}</Chip>}
      {person.cedula && <Chip>CI: {person.cedula}</Chip>}
      {typeof person.age === 'number' && <Chip>{person.age} años</Chip>}
      {gender && <Chip>{gender}</Chip>}
      {person.hospital && <Chip>{person.hospital}</Chip>}
      {person.verified && <Chip color="#22c55e">Verificado</Chip>}
      {person.isMinor && <Chip color="#f59e0b">Menor</Chip>}
    </div>
  );
}

export function Find() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NormalizedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const { t } = useTranslation();

  const handleSearch = async (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setSearchFailed(false);
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);

      if (!res.ok) {
        console.error(`Search request failed: ${res.status} ${res.statusText}`);
        // Treat a non-OK response as a failed search, not a zero-result one.
        // Existing results (if any) stay visible; the empty state is suppressed.
        setSearchFailed(true);
        alert(t("find.serviceUnavailable"));
        return;
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
      setSearchFailed(true);
      alert(t('find.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    // Give state time to update before searching
    setTimeout(() => {
      const form = document.getElementById('search-form') as HTMLFormElement;
      if (form) form.requestSubmit();
    }, 0);
  };

  return (
    <div className="find-container">
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="find-title">{t('find.title')}</h1>
        <p className="find-subtitle">
          {t('find.subtitle')}
        </p>
      </div>

      <form id="search-form" className="find-form" onSubmit={handleSearch}>
        <input 
          type="text" 
          placeholder={t('find.placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="find-input"
        />
        <button 
          type="submit"
          disabled={loading}
          className="find-button"
        >
          {loading ? t('find.buttonLoading') : t('find.button')}
        </button>
      </form>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '40px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8', fontSize: '14px' }}>{t('find.examples')}</span>
        {['Maria Perez', '12345678', 'Hospital Vargas', 'Shelter'].map(example => (
          <button 
            key={example}
            onClick={() => handleExampleClick(example)}
            className="find-example-button"
          >
            {example}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'flex-end' }}>
          {(['list', 'map'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '8px 18px',
                borderRadius: '10px',
                border: '1px solid #334155',
                background: view === v ? '#3498db' : 'transparent',
                color: view === v ? '#fff' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              {v === 'list' ? `☰ ${t('find.viewList')}` : `◉ ${t('find.viewMap')}`}
            </button>
          ))}
        </div>
      )}

      {view === 'map' && results.length > 0 && <FindMap results={results} />}

      {view === 'list' && (
      <div className="search-results-list">
        {results.map((r, i) => (
          <div key={i} className="search-result-card">
            <div className="search-result-info">
              <h3 className="search-result-title">{r.title}</h3>
              <p className="search-result-subtitle">{r.subtitle}</p>
              {r.person && <PersonChips person={r.person} />}
              <div className="search-result-metadata">
                <span className="search-result-type-badge">
                  {t('find.type')}: {r.type}
                </span>
                <span className="search-result-source">
                  {t('find.source')}: <strong style={{ color: '#fff' }}>{r.provider}</strong>
                </span>
              </div>
            </div>
            <div className="search-result-action">
              <a 
                href={r.url} 
                target="_blank" 
                rel="noreferrer"
                className="search-result-button"
              >
                {t('find.openResource')}
              </a>
            </div>
          </div>
        ))}
        {shouldShowNoResults({ loading, hasSearched, searchFailed, resultCount: results.length }) && (
          <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px', fontSize: '18px' }}>
            {t('find.noResults', { query })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
