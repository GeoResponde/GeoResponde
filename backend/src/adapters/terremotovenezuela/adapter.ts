import { BaseAdapter, SubmitOptions } from '../BaseAdapter.js';
import {
  HumanitarianProvider,
  NormalizedSearchResult,
  Report,
  SubmissionResult,
} from '@georesponde/shared';
import { fetchJson } from '../../transports/rest/client.js';
import { postJson } from '../../transports/rest/postClient.js';

const API_BASE = 'https://api.terremotovenezuela.com/api/v1';

/**
 * Map GeoResponde's `damageLevel` field values onto terremotovenezuela's
 * Spanish damage grades. Falls back to `no_se` ("don't know") for anything
 * unrecognized so a submission is never rejected on this field alone.
 */
function mapDamageLevel(level: unknown): string {
  switch (String(level ?? '').toLowerCase()) {
    case 'destroyed':
      return 'total';
    case 'severe':
      return 'severo';
    case 'moderate':
      return 'parcial';
    case 'minor':
      return 'leve';
    default:
      return 'no_se';
  }
}

/**
 * Adapter for terremotovenezuela.com ("Mapa de Daños Venezuela"), a curated
 * registry of earthquake-damaged buildings. Federates the site's official
 * public API (`api.terremotovenezuela.com/api/v1`) read-only for search and the
 * map layer, and acts as a submission target for the `building-damage` topic.
 *
 * Ethics: this source also stores names of trapped/missing people. Those are
 * never requested or surfaced; only the `has_missing_persons` flag is exposed.
 */
export class TerremotoVenezuelaAdapter implements BaseAdapter {
  provider: HumanitarianProvider;
  submissionMode: 'api' = 'api';
  submissionTopics = ['building-damage'] as const;
  retryable = true;

  constructor(providerConfig: HumanitarianProvider) {
    this.provider = providerConfig;
  }

  async search(query: string): Promise<NormalizedSearchResult[]> {
    try {
      // The API has no general ?q= search; ?name= is the federated query.
      const url = `${API_BASE}/edificios?name=${encodeURIComponent(query)}&limit=50`;
      const data = await fetchJson<any[]>(url, { timeoutMs: 10000 });

      return data.map((building: any) => ({
        provider: this.provider.display_name,
        provider_id: this.provider.id,
        type: 'building',
        title: building.name || building.building_name || 'Unknown Building',
        subtitle: `${building.address || ''}, ${building.city || ''}`
          .trim()
          .replace(/^,|,$/g, '')
          .trim(),
        status: building.damage_level,
        location:
          building.lng != null && building.lat != null
            ? [building.lng, building.lat]
            : undefined,
        url: `https://terremotovenezuela.com/edificio/${building.id || building.linked_building_id || ''}`,
        thumbnail:
          building.media_urls && building.media_urls.length > 0
            ? building.media_urls[0]
            : building.media_url,
        metadata: {
          construction_type: building.construction_type,
          people_trapped: building.people_trapped,
          has_missing_persons: building.has_missing_persons,
        },
      }));
    } catch {
      console.error('[TerremotoVenezuelaAdapter] Search failed (network/transport error)');
      return [];
    }
  }

  /**
   * Forward a `building-damage` report to terremotovenezuela's `/reportes`
   * endpoint. Dry-run is the SAFE default (per the federator directive nothing
   * is sent unless the caller explicitly opts into a live send). PII (reporter
   * contact) is mapped only for a live send and never logged.
   *
   * A real POST fires ONLY when BOTH hold: `opts.dryRun === false` AND
   * `GEORESPONDE_SUBMIT_LIVE === '1'` (mirrors Ushahidi/VR). A bare `?dryRun=0`
   * never live-POSTs — it degrades to a `skipped` result with the PII-safe
   * preview.
   */
  async submit(report: Report, opts?: SubmitOptions): Promise<SubmissionResult> {
    const dryRun = opts?.dryRun !== false;
    const f = report.fields ?? {};

    // Shape the outbound payload once — reused for the dry-run preview and the
    // live send so the preview is faithful to what would actually be sent.
    // `building-damage` collects `address` (not a separate building name/city),
    // so `building_name` is derived from `address` and `city` is only sent when
    // the report actually carries it (otherwise omitted).
    const coords = Array.isArray(f.locationCoords) ? f.locationCoords : undefined;
    const city = typeof f.city === 'string' && f.city.trim() ? f.city.trim() : undefined;
    const payload = {
      building_name: (f.address as string) || 'Unknown',
      address: (f.address as string) || 'Unknown',
      ...(city ? { city } : {}),
      damage_level: mapDamageLevel(f.damageLevel),
      description: (f.description as string) || '',
      lng: coords ? coords[0] : undefined,
      lat: coords ? coords[1] : undefined,
      building_type: (f.buildingType as string) || undefined,
      reporter_contact: report.reporter?.contact || (f.reporterContact as string) || undefined,
    };

    // PII-safe preview: strip reporter_contact from what we echo back.
    const { reporter_contact: _omit, ...safePreview } = payload;

    if (dryRun) {
      return {
        provider: this.provider.id,
        mode: 'dry-run',
        status: 'skipped',
        preview: safePreview,
        idempotencyKey: opts?.idempotencyKey,
      };
    }

    // Live path: fire ONLY when explicitly enabled. A bare `?dryRun=0` never
    // sends — it degrades to `skipped` with the PII-safe preview.
    const liveEnabled = process.env.GEORESPONDE_SUBMIT_LIVE === '1';
    if (!liveEnabled) {
      return {
        provider: this.provider.id,
        mode: 'dry-run',
        status: 'skipped',
        preview: safePreview,
        idempotencyKey: opts?.idempotencyKey,
      };
    }

    const submittedAt = new Date().toISOString();

    try {
      const { status, body } = await postJson<{ id?: string; reference_id?: string }>(
        `${API_BASE}/reportes`,
        payload,
        { idempotencyKey: opts?.idempotencyKey, retryable: true },
      );

      if (status >= 200 && status < 300) {
        const remoteId = body?.id || body?.reference_id;
        return {
          provider: this.provider.id,
          mode: 'live',
          status: 'ok',
          receipt: {
            remoteId: remoteId != null ? String(remoteId) : undefined,
            url: remoteId ? `https://terremotovenezuela.com/edificio/${remoteId}` : undefined,
            timestamp: submittedAt,
          },
          idempotencyKey: opts?.idempotencyKey,
          submittedAt,
        };
      }

      return {
        provider: this.provider.id,
        mode: 'live',
        status: 'error',
        error: `API returned ${status}`,
        retryable: status >= 500 || status === 429,
        idempotencyKey: opts?.idempotencyKey,
        submittedAt,
      };
    } catch {
      // Never surface the raw error (may echo the URL/payload). PII-free message.
      return {
        provider: this.provider.id,
        mode: 'live',
        status: 'error',
        error: 'terremotovenezuela submission failed (network/transport error)',
        retryable: true,
        idempotencyKey: opts?.idempotencyKey,
        submittedAt,
      };
    }
  }

  /**
   * Damaged-buildings GeoJSON for the Situation map layer. Proxies the official
   * `/edificios` dataset (up to 1000 records) as a normalized FeatureCollection.
   * Degrades to an empty collection rather than throwing.
   */
  async getGeoJSON(): Promise<any> {
    try {
      const data = await fetchJson<any[]>(`${API_BASE}/edificios?limit=1000`, {
        timeoutMs: 10000,
      });

      const features = data
        .filter((b) => b.lng != null && b.lat != null)
        .map((building) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [building.lng, building.lat],
          },
          properties: {
            id: building.id,
            name: building.name || building.building_name || 'Unknown Building',
            category: 'verified_building',
            status: building.damage_level,
            damage_gra: building.damage_level,
            source: `https://terremotovenezuela.com/edificio/${building.id || building.linked_building_id || ''}`,
            provider_id: this.provider.id,
          },
        }));

      return { type: 'FeatureCollection', features };
    } catch {
      // Degrade to an empty collection; never surface the raw error/URL.
      console.error('[TerremotoVenezuelaAdapter] getGeoJSON failed (network/transport error)');
      return { type: 'FeatureCollection', features: [] };
    }
  }
}
