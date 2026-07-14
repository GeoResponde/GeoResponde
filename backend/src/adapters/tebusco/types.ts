export interface TeBuscoRecord {
  uid: string;
  name: string;
  cid?: string | null;
  state: string; // 'search' | 'hurt' | 'located' | 'safe' | 'reunited' | 'gone'
  place?: string | null;
  msg?: string | null;
  by_who?: string | null;
  ts: number;
  updated_at?: string | null;
  phone?: string | null;
  color_pulsera?: string | null;
  codigo_pulsera?: string | null;
}
