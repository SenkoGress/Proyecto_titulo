// src/features/inventario/components/compartidos/CapturaCamara.tsx
import { useEffect, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import { reducirImagen } from '@/shared/utils/reducirImagen'

type Props = {
  abierto: boolean
  onCerrar: () => void
  onTomada: (imagen: string) => void
}

// toma la foto del producto con la camara del equipo
export function CapturaCamara({ abierto, onCerrar, onTomada }: Props) {
  const video = useRef<HTMLVideoElement | null>(null)
  const senal = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lista, setLista] = useState(false)

  // cortar la camara: si no, el equipo queda con la luz encendida
  function apagar() {
    senal.current?.getTracks().forEach((pista) => pista.stop())
    senal.current = null
    setLista(false)
  }

  useEffect(() => {
    if (!abierto) return
    let cancelado = false

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment', width: 1280 } })
      .then((flujo) => {
        if (cancelado) {
          flujo.getTracks().forEach((pista) => pista.stop())
          return
        }
        senal.current = flujo
        if (video.current) {
          video.current.srcObject = flujo
          setLista(true)
        }
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo abrir la camara. Revisa el permiso del navegador.')
      })

    return () => {
      cancelado = true
      apagar()
    }
  }, [abierto])

  // congelar el cuadro actual y reducirlo igual que una foto subida
  async function tomar() {
    const elemento = video.current
    if (!elemento) return

    const lienzo = document.createElement('canvas')
    lienzo.width = elemento.videoWidth
    lienzo.height = elemento.videoHeight
    lienzo.getContext('2d')?.drawImage(elemento, 0, 0)

    try {
      onTomada(await reducirImagen(lienzo.toDataURL('image/jpeg')))
      onCerrar()
    } catch {
      setError('No se pudo guardar la foto. Intenta de nuevo.')
    }
  }

  return (
    <Dialog open={abierto} onClose={onCerrar} maxWidth="sm" fullWidth>
      <DialogTitle>Tomar la foto del producto</DialogTitle>

      <DialogContent>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Box
            sx={{
              position: 'relative',
              bgcolor: 'common.black',
              borderRadius: 1,
              overflow: 'hidden',
              aspectRatio: '4 / 3',
            }}
          >
            <Box
              component="video"
              ref={video}
              autoPlay
              playsInline
              muted
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            {!lista && (
              <CircularProgress
                size={32}
                sx={{ position: 'absolute', top: '50%', left: '50%', mt: -2, ml: -2 }}
              />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onCerrar}>Cancelar</Button>
        <Button variant="contained" startIcon={<PhotoCameraIcon />} disabled={!lista} onClick={tomar}>
          Tomar la foto
        </Button>
      </DialogActions>
    </Dialog>
  )
}
