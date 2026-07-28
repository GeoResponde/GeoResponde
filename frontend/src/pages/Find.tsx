import { useState } from 'react';
import type { CandidateEntity } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';
import { FindMap } from '../components/Map/FindMap';
import { CandidateEntityCard } from '../components/CandidateEntityCard';
import { API_BASE } from '../lib/api';
import { shouldShowNoResults } from '../lib/searchState';

export function Find() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CandidateEntity[]>([]);
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
        {results.map((r) => (
          <CandidateEntityCard key={r.id} candidate={r} />
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
