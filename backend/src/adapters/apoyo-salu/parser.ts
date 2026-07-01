import { NormalizedSearchResult } from '@georesponde/shared';

/**
 * Public storage bucket that hosts the missing-person photos. The stored
 * `storage_path` is relative to this base URL.
 */
const IMAGE_BASE_URL =
  'https://qgalaewrpqvdpfuuwlrs.supabase.co/storage/v1/object/public/missing-persons-images/';

/**
 * Subset of a missing-person record returned by the apoyo.salu.pro API. Only
 * the fields we consume are typed.
 */
export interface ApoyoSaluItem {
  id: string;
  nombre?: string;
  apellido?: string;
  cedula?: string | null;
  edad_aproximada?: number | null;
  genero?: string | null;
  ultimo_lugar_visto?: string | null;
  informacion_adicional?: string | null;
  estado?: string | null;
  created_at?: string;
  updated_at?: string;
  has_image?: boolean;
  missing_person_images?: Array<{ storage_path?: string }>;
}

export interface ApoyoSaluResponse {
  items?: ApoyoSaluItem[];
  next_cursor?: string | null;
  has_more?: boolean;
  error?: string | null;
}

/**
 * Resolve the public thumbnail URL from the first image with a storage path.
 * Returns `undefined` when no usable image is present.
 */
function resolveThumbnail(item: ApoyoSaluItem): string | undefined {
  const storagePath = item.missing_person_images?.[0]?.storage_path;
  if (!storagePath) return undefined;
  return `${IMAGE_BASE_URL}${storagePath}`;
}

/**
 * Normalize a single apoyo.salu.pro record into the gateway's standard shape.
 */
export function normalizeItem(item: ApoyoSaluItem): NormalizedSearchResult {
  const title = `${item.nombre ?? ''} ${item.apellido ?? ''}`.trim();

  const subtitle =
    [item.ultimo_lugar_visto, item.informacion_adicional]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' · ') || undefined;

  return {
    provider: 'Apoyo',
    provider_id: item.id,
    type: 'person',
    title,
    subtitle,
    status: item.estado ?? undefined,
    last_update: item.updated_at || item.created_at,
    thumbnail: resolveThumbnail(item),
    // No confirmed per-person route and the SPA does not seed its search from
    // the URL, so /?search= linked nowhere. Link to the site home instead.
    url: 'https://apoyo.salu.pro/',
    metadata: {
      cedula: item.cedula,
      edad: item.edad_aproximada,
      genero: item.genero,
    },
  };
}

/**
 * Parse a full apoyo.salu.pro response into normalized results. Returns an
 * empty array when `items` is missing or not an array.
 */
export function parseApoyoSaluResponse(
  response: ApoyoSaluResponse,
): NormalizedSearchResult[] {
  const items = response?.items;
  if (!Array.isArray(items)) return [];
  return items.map(normalizeItem);
}
