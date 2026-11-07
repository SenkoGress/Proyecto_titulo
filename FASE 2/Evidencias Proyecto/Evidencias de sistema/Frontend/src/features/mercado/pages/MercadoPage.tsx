// src/features/mercado/pages/MercadoPage.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import { Migas } from '@/shared/components/ui/Migas'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import {
  SITIOS,
  hayVisorIncrustado,
  terminoDeBusqueda,
  urlDeBusqueda,
} from '@/features/mercado/utils/busquedaMercado'
import type { SitioMercado } from '@/features/mercado/utils/busquedaMercado'

// consultar a cuanto se vende un producto afuera, sin salir del sistema
export function MercadoPage() {
  const inventario = useInventario()
  const [sitio, setSitio] = useState<SitioMercado>('mercadolibre')
  const [termino, setTermino] = useState('')

  const incrustado = useMemo(() => hayVisorIncrustado(), [])
  const url = urlDeBusqueda(sitio, termino)

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Migas rutas={['Compras', 'Precios de mercado']} />
        <Typography variant="h1" sx={{ mb: 0.5 }}>
          Precios de mercado
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Consulta a cuanto se vende un producto afuera. GesTock no calcula ni compara estos precios:
          muestra el sitio tal cual, para que decidas tu.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="Producto del catalogo"
          value=""
          onChange={(evento) => setTermino(evento.target.value)}
          sx={{ minWidth: 260 }}
        >
          {(inventario.data ?? []).map((producto) => (
            <MenuItem key={producto.id} value={producto.nombre}>
              {producto.nombre}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label="O escribe que buscar"
          value={termino}
          onChange={(evento) => setTermino(evento.target.value)}
          sx={{ flexGrow: 1, minWidth: 220 }}
        />

        <ToggleButtonGroup
          value={sitio}
          exclusive
          size="small"
          onChange={(_, valor: SitioMercado | null) => valor && setSitio(valor)}
        >
          {SITIOS.map((opcion) => (
            <ToggleButton key={opcion.id} value={opcion.id}>
              {opcion.nombre}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      {termino && (
        <Typography variant="caption" color="text.secondary">
          Buscando "{terminoDeBusqueda(termino)}". Se quitan el envase y el formato de caja, que no se
          usan para buscar en el mercado.
        </Typography>
      )}

      {/* el visor incrustado es una vista de navegador de verdad y solo existe en el escritorio */}
      {incrustado ? (
        <Paper variant="outlined" sx={{ flexGrow: 1, minHeight: 420, overflow: 'hidden' }}>
          {url ? (
            <webview src={url} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Elige un producto o escribe que buscar.
              </Typography>
            </Box>
          )}
        </Paper>
      ) : (
        <Alert
          severity="info"
          action={
            url && (
              <Button
                size="small"
                startIcon={<OpenInNewOutlined />}
                onClick={() => window.open(url, '_blank', 'noopener')}
              >
                Abrir
              </Button>
            )
          }
        >
          El sitio se muestra adentro solo en la aplicacion instalada. Desde el navegador se abre en
          una pestaña aparte.
        </Alert>
      )}
    </Box>
  )
}
