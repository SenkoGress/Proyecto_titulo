// src/shared/components/ui/Ayuda.tsx
import Tooltip from '@mui/material/Tooltip'
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined'

type Props = {
  texto: string
  // para alinearlo con un titulo mas grande
  tamano?: 'inherit' | 'small'
}

// signo de pregunta que explica que hace un boton o que significa un dato, para quien recien
// aprende a usar la caja
export function Ayuda({ texto, tamano = 'small' }: Props) {
  return (
    <Tooltip title={texto} enterTouchDelay={0}>
      <HelpOutlineOutlined
        fontSize={tamano}
        aria-label={texto}
        sx={{ color: 'text.disabled', cursor: 'help', verticalAlign: 'middle' }}
      />
    </Tooltip>
  )
}
