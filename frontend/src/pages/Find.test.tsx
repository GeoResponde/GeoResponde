// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Find } from './Find';
import type { UnifiedSearchResource } from '@georesponde/shared';
import userEvent from '@testing-library/user-event';

// Mock dependencies
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal: string) => defaultVal || key,
  }),
}));

vi.mock('../components/Map/FindMap', () => ({
  FindMap: () => <div data-testid="find-map">Mock Map</div>
}));

const mockResources: UnifiedSearchResource[] = [
  {
    id: '1',
    entityType: 'person',
    relevanceScore: 10,
    rankingExplanations: [],
    candidate: {
      id: 'c1',
      entityType: 'person',
      confidence: 'HIGH',
      createdAt: '2026-07-29',
      updatedAt: '2026-07-29',
      conflicts: [],
      observations: [
        {
          id: 'o1',
          provider: 'test-provider',
          providerRecordId: 'r1',
          entityType: 'person',
          identityHints: {},
          normalizedFields: {
            provider: 'test-provider',
            provider_id: 'r1',
            type: 'person',
            title: 'Maria Perez',
            url: 'http://test.com',
            person: { fullName: 'Maria Perez', age: 30 }
          }
        }
      ]
    }
  },
  {
    id: '2',
    entityType: 'shelter',
    relevanceScore: 5,
    rankingExplanations: [],
    result: {
      provider: 'test-provider-2',
      provider_id: 's1',
      type: 'shelter',
      title: 'Refugio Central',
      url: 'http://test2.com'
    }
  }
];

describe('Find page rendering', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders categorized results correctly when search returns data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResources
    });

    render(<Find />);
    
    // Type query and search
    const input = screen.getByPlaceholderText('find.placeholder');
    await userEvent.type(input, 'Maria');
    
    const searchBtn = screen.getByText('find.button');
    await userEvent.click(searchBtn);

    // Wait for categories to appear
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /person \(\d+\)/i })).toBeTruthy();
      expect(screen.getByRole('heading', { name: /shelter \(\d+\)/i })).toBeTruthy();
    });

    // The first section (person) should be auto-expanded and render the card
    // Wait for the title 'Maria Perez' to be visible inside the ResourceCard
    expect(screen.getByRole('heading', { name: /Maria Perez/i })).toBeTruthy();

    // The shelter section should be collapsed by default
    expect(screen.queryByRole('heading', { name: /Refugio Central/i })).toBeNull();
    
    // Expand the shelter section
    await userEvent.click(screen.getByRole('heading', { name: /shelter \(\d+\)/i }));
    
    // Now Refugio Central should be rendered
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Refugio Central/i })).toBeTruthy();
    });
  });
});
