// src/features/mercado/pages/MercadoPage.tsx
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined'
import { Migas } from '@/shared/components/ui/Migas'
import { useInventario } from '@/features/inventario/hooks/useInventario'
import {
  SITIOS,
  VISTAS,
  hayVisorIncrustado,
  pideCuenta,
  terminoDeBusqueda,
  urlDeBusqueda,
  urlDeVista,
} from '@/features/mercado/utils/busquedaMercado'
import type { SitioMercado, VistaMercado } from '@/features/mercado/utils/busquedaMercado'

// mirar que se esta vendiendo afuera, y de paso a cuanto, sin salir del sistema
export function MercadoPage() {
  const inventario = useInventario()
  const [pestana, setPestana] = useState(0)
  const [vista, setVista] = useState<VistaMercado>('tendencias')
  const [sitio, setSitio] = useState<SitioMercado>('aliexpress')
  const [termino, setTermino] = useState('')

  const incrustado = useMemo(() => hayVisorIncrustado(), [])
  const buscando = pestana === 1
  const url = buscando ? urlDeBusqueda(sitio, termino) : urlDeVista(vista)
  const descripcion = VISTAS.find((v) => v.id === vista)!.descripcion

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Migas rutas={['Compras', 'Tendencias del mercado']} />
        <Typography variant="h1" sx={{ mb: 0.5 }}>
          Tendencias del mercado
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Mira que se esta vendiendo afuera y a cuanto. GesTock no calcula ni compara estos precios:
          muestra el sitio tal cual, para que decidas tu.
        </Typography>
      </Box>

      <Tabs value={pestana} onChange={(_, valor: number) => setPestana(valor)}>
        <Tab label="Que se vende" />
        <Tab label="Buscar un producto" />
      </Tabs>

      <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        {buscando ? (
          <>
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
          </>
        ) : (
          <ToggleButtonGroup
            value={vista}
            exclusive
            size="small"
            onChange={(_, valor: VistaMercado | null) => valor && setVista(valor)}
          >
            {VISTAS.map((opcion) => (
              <ToggleButton key={opcion.id} value={opcion.id}>
                {opcion.nombre}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        )}
      </Paper>

      {buscando ? (
        <>
          {termino && (
            <Typography variant="caption" color="text.secondary">
              Buscando "{terminoDeBusqueda(termino)}". Se quitan el envase y el formato de caja, que
              no se usan para buscar en el mercado.
            </Typography>
          )}
          {pideCuenta(sitio) && (
            <Alert severity="warning">
              Mercado Libre pide iniciar sesion para ver el listado de un producto. Las dos vistas de
              la pestaña anterior si se ven sin cuenta.
            </Alert>
          )}
        </>
      ) : (
        <Typography variant="caption" color="text.secondary">
          {descripcion} Para ver el listado de uno de estos productos, Mercado Libre pide iniciar
          sesion.
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
