// src/features/inventario/components/compartidos/SugerenciaCodigoBarras.tsx
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import InventoryOutlined from '@mui/icons-material/Inventory2Outlined'
import { nombreSugerido } from '@/features/inventario/utils/fichaCodigoBarras'
import type { ResultadoBusqueda } from '@/features/inventario/utils/fichaCodigoBarras'

type Props = {
  resultado: ResultadoBusqueda
  onUsar: (nombre: string) => void
  onIgnorar: () => void
}

// lo que se ofrece despues de buscar un codigo de barras. Son datos de un tercero: se muestran
// al lado y el nombre no se cambia hasta que la persona lo acepta
export function SugerenciaCodigoBarras({ resultado, onUsar, onIgnorar }: Props) {
  const { encontrada, enCatalogo, motivo } = resultado

  // el aviso de duplicado vale aunque Open Food Facts no conozca el producto
  const avisoCatalogo = enCatalogo && (
    <Alert severity="warning" sx={{ mb: encontrada ? 1.5 : 0 }}>
      Este codigo de barras ya lo tiene <strong>{enCatalogo.nombre}</strong> ({enCatalogo.sku}). Si
      lo guardas, vas a tener el mismo producto dos veces.
    </Alert>
  )

  if (!encontrada) {
    return (
      <Box sx={{ mb: 2 }}>
        {avisoCatalogo}
        <Alert severity="info" onClose={onIgnorar}>
          {motivo === 'no_esta'
            ? 'Este codigo no esta en Open Food Facts. Completa el producto a mano, como siempre.'
            : 'No se pudo consultar Open Food Facts. Completa el producto a mano, como siempre.'}
        </Alert>
      </Box>
    )
  }

  const sugerido = nombreSugerido(encontrada)

  return (
    <Box sx={{ mb: 2 }}>
      {avisoCatalogo}

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          SUGERENCIA DE OPEN FOOD FACTS
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mt: 1 }}>
          {encontrada.imagen ? (
            <Box
              component="img"
              src={encontrada.imagen}
              alt={sugerido}
              sx={{
                width: 72,
                height: 72,
                objectFit: 'contain',
                flexShrink: 0,
                borderRadius: 1,
                bgcolor: 'background.default',
              }}
            />
          ) : (
            <Box
              sx={{
                width: 72,
                height: 72,
                flexShrink: 0,
                borderRadius: 1,
                bgcolor: 'background.default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.disabled',
              }}
            >
              <InventoryOutlined />
            </Box>
          )}

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {sugerido}
            </Typography>
            {encontrada.marca && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Marca: {encontrada.marca}
              </Typography>
            )}
            {encontrada.contenido && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Contenido: {encontrada.contenido}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" onClick={() => onUsar(sugerido)}>
            Usar este nombre
          </Button>
          <Button size="small" onClick={onIgnorar}>
            Ignorar
          </Button>
        </Box>

        {/* al usar el nombre tambien baja la foto, salvo que ya haya una propia cargada */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Datos y foto de Open Food Facts (ODbL / CC BY-SA). Pueden estar incompletos o
          equivocados: revisa antes de guardar. Al usar el nombre tambien se toma la foto, salvo
          que ya hayas cargado una propia.
        </Typography>
      </Paper>
    </Box>
  )
}
