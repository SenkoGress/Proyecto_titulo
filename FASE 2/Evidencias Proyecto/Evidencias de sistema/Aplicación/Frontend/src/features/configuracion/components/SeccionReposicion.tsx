// src/features/configuracion/components/SeccionReposicion.tsx
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { useConfigRopStore } from '@/shared/stores/configRopStore'
import { CONFIG_ROP_POR_DEFECTO } from '@/features/replenishment/types'
import type { ConfigRop } from '@/features/replenishment/types'

// parametros del punto de reorden, compartidos por dashboard y proveedores
export function SeccionReposicion() {
  const config = useConfigRopStore((estado) => estado.config)
  const cambiarConfig = useConfigRopStore((estado) => estado.cambiarConfig)
  const restaurar = useConfigRopStore((estado) => estado.restaurar)

  const esPorDefecto =
    config.analysisDays === CONFIG_ROP_POR_DEFECTO.analysisDays &&
    config.leadTimeDays === CONFIG_ROP_POR_DEFECTO.leadTimeDays &&
    config.safetyFactor === CONFIG_ROP_POR_DEFECTO.safetyFactor

  const cambiar = (campo: keyof ConfigRop, texto: string) => {
    const numero = Number(texto)
    if (Number.isNaN(numero) || numero <= 0) return
    cambiarConfig({ ...config, [campo]: numero })
  }

  return (
    <Seccion
      titulo="Reposicion automatica"
      descripcion="Con que criterio el sistema decide que un producto hay que pedirlo."
      icono={<AutorenewOutlined />}
      origen="equipo"
    >
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <TextField
          label="Dias de historial"
          type="number"
          size="small"
          value={config.analysisDays}
          onChange={(evento) => cambiar('analysisDays', evento.target.value)}
          helperText="Con cuantos dias de ventas se mide la demanda"
          sx={{ width: 200 }}
        />

        <TextField
          label="Dias de entrega"
          type="number"
          size="small"
          value={config.leadTimeDays}
          onChange={(evento) => cambiar('leadTimeDays', evento.target.value)}
          helperText="Cuanto demora en llegar un pedido"
          sx={{ width: 200 }}
        />

        <TextField
          label="Factor de seguridad"
          type="number"
          size="small"
          value={config.safetyFactor}
          onChange={(evento) => cambiar('safetyFactor', evento.target.value)}
          slotProps={{ htmlInput: { step: 0.1 } }}
          helperText="Colchon extra sobre el consumo estimado"
          sx={{ width: 200 }}
        />

        <Button onClick={restaurar} disabled={esPorDefecto} sx={{ mt: 0.5 }}>
          Restaurar valores por defecto
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Punto de reorden = demanda diaria x dias de entrega + stock minimo del producto. Estos valores se mandan tal
        cual al calculo del servidor y afectan el Dashboard y la pantalla de Proveedores.
      </Typography>
    </Seccion>
  )
}
