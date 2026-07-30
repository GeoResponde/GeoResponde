import { useState } from 'react';
import type { UnifiedSearchResource } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';
import { FindMap } from '../components/Map/FindMap';
import { ResourceCard } from '../components/ResourceCard';
import { API_BASE } from '../lib/api';
import { shouldShowNoResults } from '../lib/searchState';

export function Find() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnifiedSearchResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
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
      const normalizedData = data.map((r: UnifiedSearchResource) => {
        let type = (r.entityType || 'unknown').toLowerCase();
        if (type === 'shelters') type = 'shelter';
        else if (type === 'hospitals') type = 'hospital';
        else if (type === 'persons') type = 'person';
        else if (type === 'buildings') type = 'building';
        return { ...r, entityType: type };
      });
      setResults(normalizedData);
      
      // Auto-expand the first non-empty group based on the highest ranked result
      if (normalizedData.length > 0) {
        const topEntityType = normalizedData[0].entityType;
        setExpandedSections(new Set([topEntityType]));
      } else {
        setExpandedSections(new Set());
      }
      setActiveFilter('all');
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

  const toggleSection = (entityType: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(entityType)) next.delete(entityType);
      else next.add(entityType);
      return next;
    });
  };

  // Group and filter results dynamically
  const entityTypes = Array.from(new Set(results.map(r => r.entityType)));
  const filteredResults = activeFilter === 'all' ? results : results.filter(r => r.entityType === activeFilter);
  
  const groupedResults = entityTypes.reduce((acc, type) => {
    const typeResults = filteredResults.filter(r => r.entityType === type);
    if (typeResults.length > 0) {
      acc[type] = typeResults;
    }
    return acc;
  }, {} as Record<string, UnifiedSearchResource[]>);

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
        <div style={{ marginBottom: '20px' }}>
          {/* Dynamic Filter Chips */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '6px 14px', borderRadius: '16px', border: '1px solid #334155',
                background: activeFilter === 'all' ? '#3498db' : 'transparent',
                color: activeFilter === 'all' ? '#fff' : '#94a3b8', cursor: 'pointer'
              }}
            >
              {t('find.filterAll', 'All')}
            </button>
            {entityTypes.map(type => (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                style={{
                  padding: '6px 14px', borderRadius: '16px', border: '1px solid #334155',
                  background: activeFilter === type ? '#3498db' : 'transparent',
                  color: activeFilter === type ? '#fff' : '#94a3b8', cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {t(`find.entityType.${type}`, type)}
              </button>
            ))}
          </div>

          {/* View Toggles */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
        </div>
      )}

      {view === 'map' && results.length > 0 && <FindMap results={results} />}

      {view === 'list' && (
      <div className="search-results-list">
        {Object.entries(groupedResults).map(([type, groupResults]) => {
          const isExpanded = expandedSections.has(type);
          return (
            <div key={type} style={{ marginBottom: '24px' }}>
              <div 
                onClick={() => toggleSection(type)}
                style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: '#1e293b', borderRadius: '8px',
                  cursor: 'pointer', marginBottom: '12px' 
                }}
              >
                <h2 style={{ margin: 0, fontSize: '18px', color: '#fff', textTransform: 'capitalize' }}>
                  {t(`find.entityType.${type}`, type)} ({groupResults.length})
                </h2>
                <span style={{ color: '#94a3b8', fontSize: '20px' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </div>
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {groupResults.map((r) => (
                    <ResourceCard key={r.id} resource={r} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
