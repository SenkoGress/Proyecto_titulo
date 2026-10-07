// src/features/inventario/components/tecnico/EstadoFefoChip.tsx
import Chip from '@mui/material/Chip'
import type { NivelFilaFefo } from '@/features/inventario/utils/matrizFefo'

// texto y color por nivel de riesgo
const estilos: Record<NivelFilaFefo, { texto: string; color: 'error' | 'warning' | 'success' | 'default' }> = {
  ROJO_CRITICO: { texto: 'CRITICO', color: 'error' },
  NARANJA_URGENTE: { texto: 'URGENTE', color: 'warning' },
  AMARILLO_ALERTA: { texto: 'ALERTA', color: 'warning' },
  AMARILLO_PREVENTIVO: { texto: 'PREVENTIVO', color: 'default' },
  VERDE: { texto: 'VIGENTE', color: 'success' },
  SIN_REGISTRO: { texto: 'SIN REGISTRO', color: 'default' },
}

type Props = {
  nivel: NivelFilaFefo
  diasRestantes: number | null
}

export function EstadoFefoChip({ nivel, diasRestantes }: Props) {
  const estilo = estilos[nivel]
  const detalle = diasRestantes === null ? '' : diasRestantes < 0 ? ` · hace ${Math.abs(diasRestantes)}d` : ` · ${diasRestantes}d`

  return <Chip size="small" color={estilo.color} label={`${estilo.texto}${detalle}`} />
}
