// src/features/invoices/components/SubirFactura.tsx
import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { archivoABase64, validarArchivo } from '@/features/invoices/utils/archivoBase64'
import { useEscanearFactura } from '@/features/invoices/hooks/useInvoices'
import type { PrevisualizacionFactura } from '@/features/invoices/types'

type Props = {
  onEscaneada: (preview: PrevisualizacionFactura) => void
}

// paso 1: subir el archivo, antes de que pase por el ocr
export function SubirFactura({ onEscaneada }: Props) {
  const inputArchivo = useRef<HTMLInputElement>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)

  const escanear = useEscanearFactura()

  // leer y enviar el archivo elegido
  async function procesarArchivo(archivo: File | undefined) {
    if (!archivo) return

    const error = validarArchivo(archivo)
    if (error) {
      setErrorArchivo(error)
      return
    }
    setErrorArchivo(null)

    const base64 = await archivoABase64(archivo)
    escanear.mutate(
      { base64, nombre: archivo.name, tipo: archivo.type },
      { onSuccess: onEscaneada },
    )
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', mt: 4 }}>
      <Paper
        variant="outlined"
        onDragOver={(evento) => {
          evento.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(evento) => {
          evento.preventDefault()
          setArrastrando(false)
          procesarArchivo(evento.dataTransfer.files[0])
        }}
        sx={{
          p: 5,
          textAlign: 'center',
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: arrastrando ? 'primary.main' : 'divider',
          bgcolor: arrastrando ? 'action.hover' : 'background.paper',
        }}
      >
        {escanear.isPending ? (
          // esperando al ocr
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography sx={{ fontWeight: 600 }}>Leyendo factura con IA...</Typography>
            <Typography variant="body2" color="text.secondary">
              Extrayendo proveedor, productos y montos
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <UploadFileIcon sx={{ fontSize: 56, color: 'primary.main' }} />

            <Box>
              <Typography variant="h6">Arrastra la factura aqui</Typography>
              <Typography variant="body2" color="text.secondary">
                o selecciona un archivo PDF, JPG o PNG (maximo 6 MB)
              </Typography>
            </Box>

            <Button variant="contained" onClick={() => inputArchivo.current?.click()}>
              Subir nueva factura
            </Button>

            <input
              ref={inputArchivo}
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(evento) => procesarArchivo(evento.target.files?.[0])}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <AutoAwesomeIcon fontSize="small" color="disabled" />
              <Typography variant="caption" color="text.secondary">
                Se procesa con reconocimiento inteligente (OCR)
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      {errorArchivo && (
        <Box sx={{ mt: 2 }}>
          <ErrorBox error={new Error(errorArchivo)} />
        </Box>
      )}

      {escanear.isError && (
        <Box sx={{ mt: 2 }}>
          <ErrorBox error={escanear.error} />
        </Box>
      )}
    </Box>
  )
}
