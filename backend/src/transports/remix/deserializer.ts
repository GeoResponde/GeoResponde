import { decode } from 'turbo-stream';

/**
 * Deserializes a Remix Single Fetch / TurboStream payload back into a standard JS object tree.
 */
export async function deserializeTurboStream(stream: ReadableStream<Uint8Array>): Promise<unknown> {
  const textStream = stream.pipeThrough(new TextDecoderStream() as any) as unknown as ReadableStream<string>;
  const flatArray = await decode(textStream);
  
  if (!Array.isArray(flatArray as any[])) {
    return flatArray;
  }

  // Unflatten the array using Remix's reference rules.
  // We keep a cache of resolved objects to handle circular references and maintain object identity.
  const resolved = new Map<number, any>();

  function resolve(index: number): any {
    if (resolved.has(index)) {
      return resolved.get(index);
    }

    const value = (flatArray as any[])[index];

    // If it's a primitive or null, just return it
    if (value === null || typeof value !== 'object') {
      // Small optimization: negative numbers might represent special types like undefined in some devalue forks, 
      // but typically we can just return primitives directly.
      if (value === -1) return undefined;
      return value;
    }

    // If it's an array, map over its elements which are index pointers
    if (Array.isArray(value)) {
      const arr: any[] = [];
      resolved.set(index, arr);
      for (const item of value) {
        if (typeof item === 'number') {
           arr.push(resolve(item));
        } else {
           arr.push(item);
        }
      }
      return arr;
    }

    // It's an object with `_K: V` structure
    const obj: any = {};
    resolved.set(index, obj);
    
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('_')) {
        const keyIndex = parseInt(key.slice(1), 10);
        const resolvedKey = resolve(keyIndex);
        
        // Sometimes the value is a direct primitive if it wasn't deduplicated, 
        // or a pointer index if it's a number.
        // Wait, in `_1: 2`, `2` is definitely a pointer index.
        const resolvedVal = resolve(val as number);
        
        obj[resolvedKey] = resolvedVal;
      } else {
        // If it's a normal key, it wasn't deduplicated? 
        obj[key] = val;
      }
    }

    return obj;
  }

  return resolve(0);
}
