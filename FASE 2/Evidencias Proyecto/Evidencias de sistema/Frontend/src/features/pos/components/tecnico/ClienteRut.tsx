// src/features/pos/components/tecnico/ClienteRut.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined'
import { useCarritoStore } from '@/features/pos/stores/carritoStore'
import { formatearRut, rutParaSii, validarRut } from '@/shared/utils/rut'

// cliente de la boleta (rut opcional)
export function ClienteRut() {
  const rutCliente = useCarritoStore((estado) => estado.rutCliente)
  const asociarRut = useCarritoStore((estado) => estado.asociarRut)

  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')

  const esValido = validarRut(texto)
  const mostrarError = texto.length > 2 && !esValido

  // guardar rut
  function confirmar() {
    if (!esValido) return
    asociarRut(rutParaSii(texto))
    setEditando(false)
    setTexto('')
  }

  // cancelar ingreso
  function cancelar() {
    setEditando(false)
    setTexto('')
  }

  return (
    <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.5 }}>
      {editando ? (
        // ingresar rut
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            autoFocus
            size="small"
            placeholder="12.345.678-9"
            value={texto}
            onChange={(evento) => setTexto(formatearRut(evento.target.value))}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') confirmar()
            }}
            error={mostrarError}
            helperText={mostrarError ? 'RUT invalido' : ' '}
            sx={{ flexGrow: 1 }}
          />
          <Button variant="contained" size="small" disabled={!esValido} onClick={confirmar}>
            Asociar
          </Button>
          <Button size="small" onClick={cancelar}>
            Cancelar
          </Button>
        </Box>
      ) : (
        // cliente actual
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonOutlineIcon color="action" />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {rutCliente ? 'Cliente identificado' : 'Cliente ocasional (boleta rapida)'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {rutCliente ? `RUT ${formatearRut(rutCliente)}` : 'Sin RUT asociado'}
              </Typography>
            </Box>
          </Box>

          {rutCliente ? (
            <Button size="small" color="error" onClick={() => asociarRut(null)}>
              Quitar
            </Button>
          ) : (
            <Button size="small" variant="outlined" onClick={() => setEditando(true)}>
              [+] Asociar RUT
            </Button>
          )}
        </Box>
      )}
    </Box>
  )
}
