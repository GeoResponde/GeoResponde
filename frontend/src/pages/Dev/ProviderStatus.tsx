import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../../lib/api';

const HEALTH_QUERY = 'a';

interface Provider {
  id: string;
  display_name: string;
  status: string;
  adapter: string;
  capabilities: string[];
}

type Health =
  | { state: 'checking' }
  | { state: 'ok'; count: number; ms: number }
  | { state: 'empty'; ms: number }
  | { state: 'error'; error: string }
  | { state: 'not_found' };

export function ProviderStatus() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/providers`)
      .then((res) => res.json())
      .then((data) => setProviders(data))
      .catch((err) => console.error('Failed to load providers', err));
  }, []);

  const checkHealth = useCallback(async (list: Provider[]) => {
    if (list.length === 0) return;
    setChecking(true);
    setHealth(Object.fromEntries(list.map((p) => [p.id, { state: 'checking' } as Health])));
    await Promise.all(
      list.map(async (p) => {
        try {
          const res = await fetch(`${API_BASE}/api/dev/inspect/${p.id}?q=${HEALTH_QUERY}`);
          const d = await res.json();
          let h: Health;
          if (d.status === 'ok') h = d.normalizedResults > 0 ? { state: 'ok', count: d.normalizedResults, ms: d.elapsedMs } : { state: 'empty', ms: d.elapsedMs };
          else if (d.status === 'not_found') h = { state: 'not_found' };
          else h = { state: 'error', error: d.error || 'error' };
          setHealth((prev) => ({ ...prev, [p.id]: h }));
        } catch (e) {
          setHealth((prev) => ({ ...prev, [p.id]: { state: 'error', error: String(e) } }));
        }
      }),
    );
    setChecking(false);
  }, []);

  // Auto-check once providers are loaded.
  useEffect(() => {
    if (providers.length > 0) checkHealth(providers);
  }, [providers, checkHealth]);

  const healthBadge = (id: string) => {
    const h = health[id];
    if (!h) return <span style={{ color: '#94a3b8' }}>—</span>;
    const base = { padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 } as const;
    switch (h.state) {
      case 'checking':
        return <span style={{ ...base, backgroundColor: '#e2e8f0', color: '#334155' }}>⏳ Checking…</span>;
      case 'ok':
        return <span style={{ ...base, backgroundColor: '#bbf7d0', color: '#065f46' }}>✅ Live · {h.count} ({h.ms}ms)</span>;
      case 'empty':
        return <span style={{ ...base, backgroundColor: '#fef08a', color: '#713f12' }}>⚠️ Reachable · 0 results</span>;
      case 'not_found':
        return <span style={{ ...base, backgroundColor: '#e2e8f0', color: '#334155' }}>No adapter</span>;
      case 'error':
        return <span style={{ ...base, backgroundColor: '#fecaca', color: '#7f1d1d' }} title={h.error}>❌ Error</span>;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Provider Status</h2>
        <button
          onClick={() => checkHealth(providers)}
          disabled={checking || providers.length === 0}
          style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #334155', background: '#3498db', color: '#fff', cursor: checking ? 'default' : 'pointer', fontWeight: 600, opacity: checking ? 0.7 : 1 }}
        >
          {checking ? 'Checking…' : 'Re-check live health'}
        </button>
      </div>

      <div style={{ border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #ddd' }}>
            <tr>
              <th style={{ padding: '12px 16px' }}>Provider Name</th>
              <th style={{ padding: '12px 16px' }}>Adapter ID</th>
              <th style={{ padding: '12px 16px' }}>Live Health</th>
              <th style={{ padding: '12px 16px' }}>Capabilities</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{p.display_name}</td>
                <td style={{ padding: '12px 16px', color: '#666', fontSize: '14px' }}>{p.adapter}</td>
                <td style={{ padding: '12px 16px' }}>{healthBadge(p.id)}</td>
                <td style={{ padding: '12px 16px' }}>
                  {p.capabilities.map((c) => (
                    <span key={c} style={{ display: 'inline-block', border: '1px solid #ccc', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', marginRight: '4px', marginBottom: '4px' }}>
                      {c}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
            {providers.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>Loading providers…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
