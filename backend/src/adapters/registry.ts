import { HumanitarianProvider } from '@georesponde/shared';
import { BaseAdapter } from './BaseAdapter.js';
import { VenezuelaTeBuscaAdapter } from './venezuelatebusca/adapter.js';
import { HdxAdapter } from './hdx/adapter.js';
import { EncuentralosAdapter } from './encuentralos/adapter.js';
import { UbicameAdapter } from './ubicame/adapter.js';
import { BuscaEnListasAdapter } from './buscaenlistas/adapter.js';
import { ApoyoSaluAdapter } from './apoyo-salu/adapter.js';
import { VenezuelaReportaAdapter } from './venezuelareporta/adapter.js';
import { DesaparecidosTerremotoAdapter } from './desaparecidos-terremoto/adapter.js';
import { HazloHoyAdapter } from './hazlohoy/adapter.js';
import { ReencuentraVeAdapter } from './reencuentra-ve/adapter.js';
import { SosVenezuelaAdapter } from './sosvenezuela/adapter.js';
import { NexoSignalAdapter } from './nexosignal/adapter.js';
import { MiGenteVeAdapter } from './migenteve/adapter.js';
import { TerremotoVenezuelaAdapter } from './terremotovenezuela/adapter.js';
import { SismoVenezuelaAdapter } from './sismovenezuela/adapter.js';
import { AyudaVenezuelaAdapter } from './ayudavenezuela/adapter.js';
import { UshahidiAdapter } from './ushahidi/adapter.js';

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
registerAdapter('HdxAdapter', HdxAdapter);
registerAdapter('EncuentralosAdapter', EncuentralosAdapter);
registerAdapter('UbicameAdapter', UbicameAdapter);
registerAdapter('BuscaEnListasAdapter', BuscaEnListasAdapter);
registerAdapter('ApoyoSaluAdapter', ApoyoSaluAdapter);
registerAdapter('VenezuelaReportaAdapter', VenezuelaReportaAdapter);
registerAdapter('DesaparecidosTerremotoAdapter', DesaparecidosTerremotoAdapter);
registerAdapter('HazloHoyAdapter', HazloHoyAdapter);
registerAdapter('ReencuentraVeAdapter', ReencuentraVeAdapter);
registerAdapter('SosVenezuelaAdapter', SosVenezuelaAdapter);
registerAdapter('NexoSignalAdapter', NexoSignalAdapter);
registerAdapter('MiGenteVeAdapter', MiGenteVeAdapter);
registerAdapter('TerremotoVenezuelaAdapter', TerremotoVenezuelaAdapter);
registerAdapter('SismoVenezuelaAdapter', SismoVenezuelaAdapter);
registerAdapter('AyudaVenezuelaAdapter', AyudaVenezuelaAdapter);
registerAdapter('UshahidiAdapter', UshahidiAdapter);
