import { HumanitarianProvider } from '@georesponde/shared';
import { BaseAdapter } from './BaseAdapter.js';
import { VenezuelaTeBuscaAdapter } from './venezuelatebusca/adapter.js';

/**
 * Any class that can build a BaseAdapter from a provider configuration.
 */
export type AdapterConstructor = new (provider: HumanitarianProvider) => BaseAdapter;

/**
 * Central registry that maps the `adapter` field declared in the provider
 * catalog to its implementation. Adding a new provider no longer requires
 * editing the Provider Gateway: register the adapter here (or at runtime via
 * `registerAdapter`) and expose it through the catalog.
 */
const registry = new Map<string, AdapterConstructor>();

/**
 * Register an adapter implementation under a stable name. The name must match
 * the `adapter` field used by providers in the catalog.
 */
export function registerAdapter(name: string, ctor: AdapterConstructor): void {
  registry.set(name, ctor);
}

/**
 * Instantiate the adapter declared by a provider, or return `undefined` when no
 * implementation is registered for `provider.adapter`.
 */
export function createAdapter(provider: HumanitarianProvider): BaseAdapter | undefined {
  const Ctor = registry.get(provider.adapter);
  return Ctor ? new Ctor(provider) : undefined;
}

/**
 * List the names of every registered adapter. Useful for diagnostics.
 */
export function registeredAdapters(): string[] {
  return [...registry.keys()];
}

// --- Built-in adapters -------------------------------------------------------
registerAdapter('VenezuelaTeBuscaAdapter', VenezuelaTeBuscaAdapter);
