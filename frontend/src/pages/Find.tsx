import { useState } from 'react';
import type { NormalizedSearchResult } from '@georesponde/shared';
import { useTranslation } from 'react-i18next';

export function Find() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NormalizedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { t } = useTranslation();

  const handleSearch = async (e: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001'}/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
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
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', flex: 1, overflowY: 'auto', width: '100%', minHeight: 0 }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#fff', marginBottom: '16px', fontSize: '36px' }}>{t('find.title')}</h1>
        <p style={{ color: '#aaa', fontSize: '18px', maxWidth: '600px', margin: '0 auto' }}>
          {t('find.subtitle')}
        </p>
      </div>

      <form id="search-form" className="find-form" onSubmit={handleSearch} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <input 
          type="text" 
          placeholder={t('find.placeholder')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '24px 32px',
            fontSize: '24px',
            borderRadius: '12px',
            border: '2px solid #334155',
            backgroundColor: '#0f172a',
            color: '#fff',
            outline: 'none',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3498db'}
          onBlur={(e) => e.target.style.borderColor = '#334155'}
        />
        <button 
          type="submit"
          disabled={loading}
          style={{
            padding: '0 40px',
            fontSize: '24px',
            fontWeight: 'bold',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#3498db',
            color: '#fff',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            opacity: loading ? 0.7 : 1
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
        >
          {loading ? t('find.buttonLoading') : t('find.button')}
        </button>
      </form>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '40px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8', fontSize: '14px' }}>{t('find.examples')}</span>
        {['Maria Perez', 'Hospital Vargas', 'Shelter', 'Costa Azul Building'].map(example => (
          <button 
            key={example}
            onClick={() => handleExampleClick(example)}
            style={{
              background: 'none',
              border: '1px solid #334155',
              borderRadius: '16px',
              color: '#38bdf8',
              cursor: 'pointer',
              padding: '6px 12px',
              fontSize: '14px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.1)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {example}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {results.map((r, i) => (
          <div key={i} className="mobile-col" style={{ 
            backgroundColor: '#1e293b', 
            padding: '24px', 
            borderRadius: '12px',
            borderLeft: '4px solid #3498db',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '24px' }}>{r.title}</h3>
              <p style={{ margin: '0 0 16px 0', color: '#cbd5e1', fontSize: '16px' }}>{r.subtitle}</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ 
                  backgroundColor: '#0f172a', 
                  color: '#94a3b8', 
                  padding: '4px 12px', 
                  borderRadius: '16px', 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  textTransform: 'capitalize'
                }}>
                  {t('find.type')}: {r.type}
                </span>
                <span style={{ 
                  backgroundColor: 'transparent', 
                  color: '#94a3b8', 
                  fontSize: '14px', 
                }}>
                  {t('find.source')}: <strong style={{ color: '#fff' }}>{r.provider}</strong>
                </span>
              </div>
            </div>
            <div>
              <a 
                href={r.url} 
                target="_blank" 
                rel="noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '12px 24px',
                  backgroundColor: '#334155',
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  transition: 'background-color 0.2s',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#475569'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#334155'}
              >
                {t('find.openResource')}
              </a>
            </div>
          </div>
        ))}
        {!loading && results.length === 0 && hasSearched && (
          <div style={{ color: '#94a3b8', textAlign: 'center', marginTop: '40px', fontSize: '18px' }}>
            {t('find.noResults', { query })}
          </div>
        )}
      </div>
    </div>
  );
}
