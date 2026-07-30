import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ResourceCard } from './ResourceCard';
import type { UnifiedSearchResource } from '@georesponde/shared';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe('ResourceCard', () => {
  it('renders a person candidate', () => {
    const mockResource: UnifiedSearchResource = {
      id: '123',
      entityType: 'person',
      relevanceScore: 100,
      rankingExplanations: [],
      candidate: {
        id: 'c1',
        entityType: 'person',
        confidence: 'HIGH',
        conflicts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        observations: [
          {
            id: 'o1',
            provider: 'SosVenezuela',
            providerRecordId: '1',
            entityType: 'person',
            identityHints: {},
            normalizedFields: {
              provider: 'SosVenezuela',
              provider_id: '1',
              type: 'person',
              title: 'Maria Perez',
              url: 'http://example.com'
            }
          }
        ]
      }
    };

    const html = renderToString(<ResourceCard resource={mockResource} />);
    console.log('--- OUTPUT ---');
    console.log(html);
    expect(html).toContain('Maria Perez');
  });

  it('renders a non-candidate result', () => {
    const mockResource: UnifiedSearchResource = {
      id: '456',
      entityType: 'shelter',
      relevanceScore: 50,
      rankingExplanations: [],
      result: {
        provider: 'SosVenezuela',
        provider_id: '2',
        type: 'shelter',
        title: 'Shelter A',
        url: 'http://example.com'
      }
    };

    const html = renderToString(<ResourceCard resource={mockResource} />);
    console.log('--- OUTPUT 2 ---');
    console.log(html);
    expect(html).toContain('Shelter A');
  });
});
