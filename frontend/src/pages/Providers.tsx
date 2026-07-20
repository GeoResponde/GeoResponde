import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ExternalLink } from 'lucide-react';
import { API_BASE, fetchProviderHealth } from '../lib/api';
import { classifyBadge, type ProviderHealthSnapshot, type HealthBadgeState } from '../lib/health';
import styles from './Providers.module.css';

interface Provider {
  id: string;
  display_name: string;
  website: string;
  description: string;
  status: string;
}

const POLL_INTERVAL_MS = 60_000; // Poll health status every 60s for public view

export function Providers() {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [health, setHealth] = useState<Record<string, ProviderHealthSnapshot>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // 1. Fetch provider catalog first to display cards instantly
    fetch(`${API_BASE}/api/providers`)
      .then((r) => r.json())
      .then((provData) => {
        if (active) {
          setProviders(provData);
          setLoading(false); // Render cards immediately
        }
      })
      .catch((err) => console.error('Failed to load providers:', err));

    // 2. Fetch health snapshots and setup background polling
    const loadHealth = () => {
      fetchProviderHealth()
        .then((healthSnap) => {
          if (active) {
            setHealth(healthSnap);
          }
        })
        .catch((err) => console.error('Failed to load health status:', err));
    };

    loadHealth(); // Initial fetch

    const intervalId = setInterval(loadHealth, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  const getStatusConfig = (state: HealthBadgeState) => {
    switch (state) {
      case 'healthy':
        return {
          label: t('providersList.statusConnected'),
          color: '#22c55e',
          bgColor: 'rgba(34, 197, 94, 0.15)',
          textColor: '#4ade80',
        };
      case 'warming':
      case 'degrading':
      case 'down':
      default:
        return {
          label: t('providersList.statusIssues'),
          color: '#94a3b8',
          bgColor: 'rgba(148, 163, 184, 0.15)',
          textColor: '#cbd5e1',
        };
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <span>{t('dev.providerStatus.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>{t('providersList.title')}</h1>
          <p className={styles.subtitle}>{t('providersList.subtitle')}</p>
        </header>

        <div className={styles.grid}>
          {providers.map((p) => {
            const snap = health[p.id];
            const badgeState = snap ? classifyBadge(snap) : 'warming';
            const statusConfig = getStatusConfig(badgeState);

            return (
              <div key={p.id} className={styles.card}>
                <div>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.providerName}>{p.display_name}</h3>
                    <div
                      className={styles.statusWrapper}
                      style={{
                        backgroundColor: statusConfig.bgColor,
                        color: statusConfig.textColor,
                      }}
                    >
                      <span
                        className={styles.statusDot}
                        style={{ backgroundColor: statusConfig.color }}
                      />
                      {statusConfig.label}
                    </div>
                  </div>
                  <p className={styles.description}>{p.description}</p>
                </div>

                {p.website && (
                  <a
                    href={p.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkButton}
                  >
                    <Globe size={16} />
                    {t('providersList.visitWebsite')}
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
