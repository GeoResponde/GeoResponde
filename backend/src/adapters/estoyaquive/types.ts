export interface MissingPerson {
  id: string;
  nombre_completo: string | null;
  cedula: string | null;
  edad: number | null;
  descripcion: string | null;
  estado: string | null;
  ultima_ubicacion: string | null;
  reportado_por: string | null;
  contacto_reportante: string | null;
  fecha_reporte: string | null;
  foto_filename: string | null;
}

export interface FoundPerson {
  id: string;
  nombre_completo: string | null;
  cedula: string | null;
  edad_aproximada: number | null;
  descripcion_fisica: string | null;
  ubicacion_actual: string | null;
  estado_salud: string | null;
  reportado_por: string | null;
  contacto_reportante: string | null;
  fecha_reporte: string | null;
  foto_filename: string | null;
}

export interface BuscarResponse {
  buscadas: MissingPerson[] | null;
  encontradas: FoundPerson[] | null;
}
