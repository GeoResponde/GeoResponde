import { describe, it, expect } from 'vitest';
import { HumanitarianProvider } from '@georesponde/shared';
import { createAdapter, registerAdapter, registeredAdapters } from '../registry.js';
import { VenezuelaTeBuscaAdapter } from '../venezuelatebusca/adapter.js';
import { BaseAdapter } from '../BaseAdapter.js';

function makeProvider(overrides: Partial<HumanitarianProvider> = {}): HumanitarianProvider {
  return {
    id: 'test-provider',
    display_name: 'Test Provider',
    website: 'https://example.org',
    description: '',
    logo: '',
    status: 'active',
    adapter: 'VenezuelaTeBuscaAdapter',
    capabilities: ['search'],
    ...overrides,
  };
}

describe('adapter registry', () => {
  it('registers the built-in VenezuelaTeBusca adapter', () => {
    expect(registeredAdapters()).toContain('VenezuelaTeBuscaAdapter');
  });

  it('instantiates the adapter declared by a provider', () => {
    const adapter = createAdapter(makeProvider());
    expect(adapter).toBeInstanceOf(VenezuelaTeBuscaAdapter);
    expect(adapter?.provider.id).toBe('test-provider');
  });

  it('returns undefined for an unregistered adapter name', () => {
    const adapter = createAdapter(makeProvider({ adapter: 'DoesNotExistAdapter' }));
    expect(adapter).toBeUndefined();
  });

  it('supports runtime registration of custom adapters', () => {
    class CustomAdapter implements BaseAdapter {
      provider: HumanitarianProvider;
      constructor(provider: HumanitarianProvider) {
        this.provider = provider;
      }
      async search() {
        return [];
      }
      async submit() {
        return true;
      }
    }

    registerAdapter('CustomAdapter', CustomAdapter);
    const adapter = createAdapter(makeProvider({ adapter: 'CustomAdapter' }));
    expect(adapter).toBeInstanceOf(CustomAdapter);
  });
});
