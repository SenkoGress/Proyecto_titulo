// limpiar.mjs
// borra de la base lo que dejan las pruebas. El backend no tiene borrado de
// productos, asi que esto va directo a SQLite.
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'

const RUTA =
  process.env.GESTOCK_SQLITE ||
  'C:/Users/david/OneDrive/Escritorio/gestock/data/gestock_local_pos.sqlite'

if (!existsSync(RUTA)) {
  console.log(`No encontre la base en ${RUTA}`)
  console.log('Pasale la ruta con la variable GESTOCK_SQLITE.')
  process.exit(1)
}

const db = new DatabaseSync(RUTA)

const productos = db
  .prepare("SELECT id, sku, nombre FROM productos WHERE sku LIKE 'PRUEBA-%'")
  .all()

if (productos.length === 0) {
  console.log('No hay nada que limpiar.')
  process.exit(0)
}

console.log(`Encontre ${productos.length} productos de prueba:`)
for (const p of productos) console.log(`  ${p.sku}  ${p.nombre}`)

db.exec('BEGIN')
try {
  for (const p of productos) {
    db.prepare('DELETE FROM mermas WHERE producto_id = ?').run(p.id)
    db.prepare('DELETE FROM historial_stock WHERE producto_id = ?').run(p.id)
    db.prepare('DELETE FROM producto_proveedores WHERE producto_id = ?').run(p.id)
    db.prepare('DELETE FROM productos WHERE id = ?').run(p.id)
  }
  db.exec('COMMIT')
} catch (error) {
  db.exec('ROLLBACK')
  console.log(`No se pudo limpiar: ${error.message}`)
  process.exit(1)
}

console.log(`\nListo. Quedan ${db.prepare('SELECT COUNT(*) c FROM productos').get().c} productos en el catalogo.`)
