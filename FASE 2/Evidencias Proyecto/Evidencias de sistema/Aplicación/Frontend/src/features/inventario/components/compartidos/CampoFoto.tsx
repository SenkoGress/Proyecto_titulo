// src/features/inventario/components/compartidos/CampoFoto.tsx
import { useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import { motivoArchivoInvalido, reducirImagen } from '@/shared/utils/reducirImagen'
import { CapturaCamara } from '@/features/inventario/components/compartidos/CapturaCamara'

type Props = {
  imagen: string | null
  onCambiar: (imagen: string | null) => void
}

// la foto del producto: se sube un archivo o se toma con la camara, y se reduce antes de guardarla
export function CampoFoto({ imagen, onCambiar }: Props) {
  const archivoRef = useRef<HTMLInputElement | null>(null)
  const [camaraAbierta, setCamaraAbierta] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function elegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    // limpiar el input: si no, elegir el mismo archivo otra vez no dispara el cambio
    evento.target.value = ''
    if (!archivo) return

    const motivo = motivoArchivoInvalido(archivo)
    if (motivo) {
      setError(motivo)
      return
    }

    setError(null)
    setProcesando(true)
    try {
      onCambiar(await reducirImagen(archivo))
    } catch (problema) {
      setError(problema instanceof Error ? problema.message : 'No se pudo leer la foto')
    } finally {
      setProcesando(false)
    }
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        FOTO DEL PRODUCTO
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, mt: 0.5, alignItems: 'flex-start' }}>
        {/* vista previa */}
        <Box
          sx={{
            width: 104,
            height: 104,
            flexShrink: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          {procesando ? (
            <CircularProgress size={24} />
          ) : imagen ? (
            <Box
              component="img"
              src={imagen}
              alt="Foto del producto"
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <ImageOutlinedIcon sx={{ color: 'text.disabled', fontSize: 34 }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<UploadFileIcon />}
              disabled={procesando}
              onClick={() => archivoRef.current?.click()}
            >
              Subir una foto
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<PhotoCameraIcon />}
              disabled={procesando}
              onClick={() => setCamaraAbierta(true)}
            >
              Tomar una foto
            </Button>

            {imagen && (
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlineIcon />}
                disabled={procesando}
                onClick={() => onCambiar(null)}
              >
                Quitar
              </Button>
            )}
          </Box>

          <Typography variant="caption" color={error ? 'error.main' : 'text.secondary'}>
            {error ?? 'Se guarda reducida a 400 pixeles, asi la caja la muestra sin internet.'}
          </Typography>
        </Box>
      </Box>

      <input
        ref={archivoRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={elegirArchivo}
      />

      {/* se monta al abrir para que el aviso de la camara no quede de la vez anterior */}
      {camaraAbierta && (
        <CapturaCamara
          abierto
          onCerrar={() => setCamaraAbierta(false)}
          onTomada={(foto) => {
            setError(null)
            onCambiar(foto)
          }}
        />
      )}
    </Box>
  )
}
