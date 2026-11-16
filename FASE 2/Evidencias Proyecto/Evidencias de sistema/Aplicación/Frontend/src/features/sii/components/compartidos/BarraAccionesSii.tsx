// src/features/sii/components/compartidos/BarraAccionesSii.tsx
import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import RefreshOutlined from '@mui/icons-material/RefreshOutlined'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import { descargarRespaldoLegal } from '@/features/sii/utils/respaldoLegal'

type Props = {
  titulo: string
  descripcion: string
  actualizando: boolean
  onActualizar: () => void
}

type Totales = Awaited<ReturnType<typeof descargarRespaldoLegal>>

export function BarraAccionesSii({ titulo, descripcion, actualizando, onActualizar }: Props) {
  const [descargando, setDescargando] = useState(false)
  const [totales, setTotales] = useState<Totales | null>(null)
  const [error, setError] = useState<string | null>(null)

  const respaldar = async () => {
    setDescargando(true)
    setError(null)

    try {
      setTotales(await descargarRespaldoLegal())
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo generar el respaldo')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Paper
        variant="outlined"
        sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {titulo}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {descripcion}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={actualizando ? <CircularProgress size={16} /> : <RefreshOutlined />}
            onClick={onActualizar}
            disabled={actualizando}
          >
            Actualizar todo
          </Button>

          <Button
            size="small"
            variant="contained"
            startIcon={descargando ? <CircularProgress size={16} color="inherit" /> : <ShieldOutlined />}
            onClick={respaldar}
            disabled={descargando}
          >
            {descargando ? 'Generando...' : 'Respaldo legal 6 anios'}
          </Button>
        </Box>
      </Paper>

      {totales && (
        <Alert severity="success" onClose={() => setTotales(null)}>
          Respaldo descargado: {totales.dtes_emitidos} documentos emitidos, {totales.facturas_compra_respaldadas}{' '}
          facturas de compra, {totales.transacciones_venta} ventas, {totales.cierres_caja} cierres de caja y{' '}
          {totales.folios_caf_autorizados} rangos de folios.
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  )
}
