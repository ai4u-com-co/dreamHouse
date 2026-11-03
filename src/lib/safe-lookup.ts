/**
 * Búsqueda por clave en un objeto-mapa que IGNORA lo heredado del prototipo.
 *
 * Con `map[clave]` una clave como "constructor", "toString" o "__proto__" devuelve una función u objeto
 * heredado (no `undefined`), así que el valor de reserva (`?? x`, `|| x`) no se activa. Si la clave la
 * controla un cliente (un campo del formulario, un parámetro de la API), eso puede colarse en un prompt
 * como "function Object() { [native code] }" o saltarse un tope de costo. Este helper devuelve
 * `undefined` salvo que la clave sea una cadena propia del mapa.
 */
export function lookup<T>(map: Readonly<Record<string, T>>, key: unknown): T | undefined {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}
