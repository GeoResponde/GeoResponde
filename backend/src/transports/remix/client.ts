import { deserializeTurboStream } from './deserializer.js';

export async function fetchRemixSingleFetch<T = unknown>(
  baseUrl: string,
  routeId: string,
  queryParams: Record<string, string>,
  timeoutMs: number = 5000
): Promise<T> {
  const url = new URL(baseUrl);
  
  // Remix Single Fetch V2 uses `_root.data` or similar for the data endpoint
  const path = url.pathname.endsWith('/') 
    ? `${url.pathname}_${routeId}.data` 
    : `${url.pathname}/_${routeId}.data`;
  url.pathname = path;

  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.set(key, value);
  }
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'text/x-turbo, */*',
        'User-Agent': 'GeoResponde-Gateway/1.0'
      }
    });
    
    if (!res.ok) {
      throw new Error(`Remix Transport responded with status: ${res.status}`);
    }
    
    if (!res.body) {
      throw new Error(`Remix Transport response has no body`);
    }

    const deserializedData = await deserializeTurboStream(res.body);
    return deserializedData as T;
  } finally {
    clearTimeout(timeout);
  }
}
