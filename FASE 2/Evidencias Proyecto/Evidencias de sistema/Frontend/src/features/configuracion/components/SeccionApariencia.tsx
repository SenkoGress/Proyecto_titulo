// src/features/configuracion/components/SeccionApariencia.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import PaletteOutlined from '@mui/icons-material/PaletteOutlined'
import LightModeOutlined from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined'
import SettingsBrightnessOutlined from '@mui/icons-material/SettingsBrightnessOutlined'
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined'
import TuneOutlined from '@mui/icons-material/TuneOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { useTemaStore } from '@/shared/stores/temaStore'
import { useModoVistaStore } from '@/shared/stores/modoVistaStore'
import type { PreferenciaTema } from '@/shared/stores/temaStore'
import type { ModoVista } from '@/shared/stores/modoVistaStore'

// una opcion con su explicacion debajo
function Opcion({ titulo, ayuda, children }: { titulo: string; ayuda: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 220 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {ayuda}
        </Typography>
      </Box>

      {children}
    </Box>
  )
}

// tema claro/oscuro y modo de interfaz
export function SeccionApariencia() {
  const preferencia = useTemaStore((estado) => estado.preferencia)
  const cambiarPreferencia = useTemaStore((estado) => estado.cambiarPreferencia)

  const modoVista = useModoVistaStore((estado) => estado.modo)
  const cambiarModo = useModoVistaStore((estado) => estado.cambiarModo)

  return (
    <Seccion
      titulo="Apariencia"
      descripcion="Como se ve la aplicacion en este computador."
      icono={<PaletteOutlined />}
      origen="equipo"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Opcion titulo="Tema" ayuda="Claro, oscuro o el que use el sistema operativo.">
          <ToggleButtonGroup
            value={preferencia}
            exclusive
            size="small"
            onChange={(_, valor: PreferenciaTema | null) => valor && cambiarPreferencia(valor)}
          >
            <ToggleButton value="claro">
              <LightModeOutlined fontSize="small" sx={{ mr: 0.75 }} />
              Claro
            </ToggleButton>
            <ToggleButton value="oscuro">
              <DarkModeOutlined fontSize="small" sx={{ mr: 0.75 }} />
              Oscuro
            </ToggleButton>
            <ToggleButton value="sistema">
              <SettingsBrightnessOutlined fontSize="small" sx={{ mr: 0.75 }} />
              Sistema
            </ToggleButton>
          </ToggleButtonGroup>
        </Opcion>

        <Opcion
          titulo="Modo de interfaz"
          ayuda="Visual es mas simple; tecnico muestra mas detalle, tablas densas y atajos de teclado."
        >
          <ToggleButtonGroup
            value={modoVista}
            exclusive
            size="small"
            onChange={(_, valor: ModoVista | null) => valor && cambiarModo(valor)}
          >
            <ToggleButton value="visual">
              <VisibilityOutlined fontSize="small" sx={{ mr: 0.75 }} />
              Visual
            </ToggleButton>
            <ToggleButton value="tecnico">
              <TuneOutlined fontSize="small" sx={{ mr: 0.75 }} />
              Tecnico
            </ToggleButton>
          </ToggleButtonGroup>
        </Opcion>
      </Box>
    </Seccion>
  )
}
