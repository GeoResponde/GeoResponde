import { useTranslation } from 'react-i18next';
import type { ProviderStatus } from '../../lib/health';

interface Props {
  state: ProviderStatus;
}

const COLORS: Record<ProviderStatus, { background: string; color: string }> = {
  HEALTHY: { background: '#bbf7d0', color: '#065f46' },
  DEGRADED: { background: '#fef08a', color: '#713f12' },
  UNAVAILABLE: { background: '#fecaca', color: '#7f1d1d' },
  UNKNOWN: { background: '#e2e8f0', color: '#334155' },
};

/**
 * Color-coded pill for a `HealthBadgeState` (HEALTH-08 + HEALTH-11 warming
 * state). Purely presentational — it reads the state from `lib/health.ts`
 * and never re-derives thresholds itself.
 */
export function HealthBadge({ state }: Props) {
  const { t } = useTranslation();
  const { background, color } = COLORS[state];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        background,
        color,
      }}
    >
      {t(`dev.providerStatus.badge.${state}`)}
    </span>
  );
}
