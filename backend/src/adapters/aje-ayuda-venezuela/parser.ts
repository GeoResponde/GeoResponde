import type { NormalizedSearchResult } from '@georesponde/shared';
import type { AyudaCentroAcopio, AyudaDonacion } from './types.js';

export function parseAjeCentroAcopio(
  record: AyudaCentroAcopio
): NormalizedSearchResult {
  const url = `https://ajevenezuela.org/ayuda-venezuela`;

  return {
    provider: 'AJE Ayuda Venezuela',
    provider_id: record.id,
    type: 'shelter',
    title: record.nombre || 'Centro de Acopio',
    subtitle: record.zona || record.ciudad || undefined,
    status: record.estado === 'activo' ? 'active' : 'inactive',
    location:
      typeof record.longitud === 'number' && typeof record.latitud === 'number'
        ? [record.longitud, record.latitud]
        : undefined,
    last_update: record.updated_at || record.created_at || undefined,
    url,
    metadata: {
      address: record.direccion,
      city: record.ciudad,
      zone: record.zona,
      phone: record.contacto_telefono,
      whatsapp: record.contacto_whatsapp,
      email: record.contacto_email,
      schedule: record.horario,
      items: record.insumos,
      notes: record.notas,
      verified: record.confirmado_por_aje,
    }
  };
}

export function parseAjeDonacion(
  record: AyudaDonacion
): NormalizedSearchResult {
  const url = record.link_oficial || `https://ajevenezuela.org/ayuda-venezuela`;

  return {
    provider: 'AJE Ayuda Venezuela',
    provider_id: record.id,
    type: 'other',
    title: record.organizacion || 'Iniciativa de Donación',
    subtitle: record.tipo_ayuda || undefined,
    status: record.estado === 'activo' ? 'active' : 'inactive',
    last_update: record.updated_at || record.created_at || undefined,
    url,
    metadata: {
      description: record.descripcion,
      type: record.tipo_ayuda,
      scope: record.alcance,
      phone: record.contacto_telefono,
      whatsapp: record.contacto_whatsapp,
      email: record.contacto_email,
      verified: record.confirmado_por_aje,
      donationData: record.datos_donacion,
    }
  };
}

export function parseAjeResponse(
  centros: AyudaCentroAcopio[] | undefined | null,
  donaciones: AyudaDonacion[] | undefined | null
): NormalizedSearchResult[] {
  const results: NormalizedSearchResult[] = [];

  if (Array.isArray(centros)) {
    results.push(...centros.map(parseAjeCentroAcopio));
  }

  if (Array.isArray(donaciones)) {
    results.push(...donaciones.map(parseAjeDonacion));
  }

  return results;
}
