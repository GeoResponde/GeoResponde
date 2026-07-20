export interface MissingItem {
  id: number;
  nombres_apellidos?: string | null;
  cedula?: string | null;
  estado?: string | null;
  ultima_ubicacion: string | null;
  tipo_reporte: string | null;
  foto_url?: string | null;
  created_at?: string | null;
}

export interface HospitalizedItem {
  id: number;
  hospital_id: number;
	nombre_hospital: string | null;
	nombres_apellidos: string | null;
	edad: string | null; //Can either be a stringified number or a description of the age e.g. "adulto mayor"
	sexo: string | null
	cedula: string | null
	parentesco: any, //All observed instances of this property are null
	procedencia: string | null
	observaciones: string | null,
	datos_adicionales: any, //All observed instances of this property are null
	foto_captura_url: string | null,
	estado_paciente: string | null,
	reportado_por: any, //All observed instances of this property are null
	necesita_ayuda: boolean | null,
	tipo_ayuda: any, //All observed instances of this property are null
	created_at: string | null,
	telefono: string | null,
	nombre_variantes: string | null,
	batch_date: string | null,
	fuente: string | null,
	es_menor: boolean | null
}
