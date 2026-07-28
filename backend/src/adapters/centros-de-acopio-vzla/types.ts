export interface CentrosDeAcopioVzlaRoot {
  estados: Estado[];
}

export interface Estado {
  nombre: string;
  ciudades: Ciudad[];
}

export interface Ciudad {
  nombre: string;
  centros: Centro[];
}

export interface Centro {
  nombre: string;
  direccion?: string;
  coords?: [number, number]; // [lat, lng]
  maps?: string;
  contacto?: string;
  recibe?: string[];
  fuente?: string;
}
