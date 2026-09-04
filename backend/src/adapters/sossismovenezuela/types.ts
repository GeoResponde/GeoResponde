/**
 * Shape of a single missing person record from the Sismo Venezuela
 * Supabase personas_no_localizadas table.
 */
export interface SossismoVenezuelaPerson {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  edad?: number | null;
  genero?: string | null;
  descripcion?: string | null;
  ultima_ubicacion?: string | null;
  foto_url?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ciudad?: string | null;
  zona?: string | null;
  ultima_vez_contactado?: string | null;
  venezuelan_id?: string | null;
  public_contact_phone?: string | null;
  contacto_nombre?: string | null;
  reporter_email?: string | null;
  contacto_telefono?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source_name?: string | null;
}

/**
 * Shape of a single collection center record from the Sismo Venezuela
 * Supabase centros_acorpio_public table.
 */
export interface SossismoVenezuelaCenter {
  id: string;
  nombre?: string | null;
  direccion?: string | null;
  address_reference?: string | null;
  ciudad?: string | null;
  state?: string | null;
  municipality?: string | null;
  zone?: string | null;
  country?: string | null;
  telefono?: string | null;
  horario?: string | null;
  items_aceptados?: string[] | null;
  source?: string | null;
  source_url?: string | null;
  estado?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}
