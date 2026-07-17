export interface AyudaCentroAcopio {
  id: string;
  nombre: string | null;
  direccion: string | null;
  ciudad: string | null;
  zona: string | null;
  horario: string | null;
  insumos: string[] | null;
  responsable: string | null;
  contacto_telefono: string | null;
  contacto_whatsapp: string | null;
  contacto_email: string | null;
  maps_url: string | null;
  notas: string | null;
  estado: string | null; // e.g. "activo"
  confirmado_por_aje: boolean | null;
  destacado: boolean | null;
  oculto: boolean | null;
  ultima_revision_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  latitud: number | null;
  longitud: number | null;
}

export interface AyudaDonacion {
  id: string;
  organizacion: string | null;
  descripcion: string | null;
  tipo_ayuda: string | null;
  alcance: string | null;
  link_oficial: string | null;
  datos_donacion: Record<string, any>[] | null;
  contacto_telefono: string | null;
  contacto_whatsapp: string | null;
  contacto_email: string | null;
  logo_url: string | null;
  estado: string | null; // e.g. "activo"
  confirmado_por_aje: boolean | null;
  destacado: boolean | null;
  oculto: boolean | null;
  ultima_revision_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}
