// src/features/proveedores/utils/marcaProveedor.ts

// palabras que no aportan a la sigla del proveedor
const PALABRAS_VACIAS = ['de', 'del', 'la', 'las', 'los', 'y', 'spa', 'ltda', 'sa', 's.a.', 'chile']

// colores del avatar (el backend no guarda logo ni color, se elige uno fijo por nombre)
const PALETA = ['#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777']

// sigla corta a partir del nombre: "Cooperativa Colun Lacteos" -> "CCL"
export function siglaProveedor(nombre: string): string {
  const palabras = nombre
    .split(/\s+/)
    .map((palabra) => palabra.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((palabra) => palabra.length > 0 && !PALABRAS_VACIAS.includes(palabra.toLowerCase()))

  if (palabras.length === 0) return nombre.slice(0, 2).toUpperCase()

  return palabras
    .slice(0, 3)
    .map((palabra) => palabra[0].toUpperCase())
    .join('')
}

// mismo nombre = siempre el mismo color, para que no cambie en cada render
export function colorProveedor(nombre: string): string {
  let suma = 0
  for (let i = 0; i < nombre.length; i++) suma += nombre.charCodeAt(i)
  return PALETA[suma % PALETA.length]
}
