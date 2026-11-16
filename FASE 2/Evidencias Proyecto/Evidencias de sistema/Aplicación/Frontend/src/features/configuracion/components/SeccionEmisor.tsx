// src/features/configuracion/components/SeccionEmisor.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { useConfigDte, useGuardarConfigDte } from '@/features/dte/hooks/useConfigDte'
import { formatearRut, rutParaSii, validarRut } from '@/shared/utils/rut'
import { env } from '@/config/env'
import type { EdicionConfigDte, EmisorFiscal } from '@/features/dte/types'

type Campo = {
  clave: keyof EdicionConfigDte
  etiqueta: string
  ayuda?: string
}

// los mismos campos que acepta POST /dte/config
const CAMPOS: Campo[] = [
  { clave: 'rut', etiqueta: 'RUT del emisor' },
  { clave: 'razonSocial', etiqueta: 'Razon social' },
  { clave: 'giro', etiqueta: 'Giro comercial' },
  { clave: 'acteco', etiqueta: 'Codigo de actividad (Acteco)', ayuda: 'El que tienes informado al SII' },
  { clave: 'direccion', etiqueta: 'Direccion de la casa matriz' },
  { clave: 'comuna', etiqueta: 'Comuna' },
  { clave: 'ciudad', etiqueta: 'Ciudad' },
  { clave: 'telefono', etiqueta: 'Telefono comercial' },
  { clave: 'correoEmisor', etiqueta: 'Correo tributario' },
]

// lo que hay guardado hoy en el servidor
function valorGuardado(emisor: EmisorFiscal | undefined, clave: keyof EdicionConfigDte): string {
  if (!emisor || clave === 'modeloEmision') return ''
  return String(emisor[clave as keyof EmisorFiscal] ?? '')
}

// datos con los que se timbran las boletas y facturas
export function SeccionEmisor() {
  const config = useConfigDte()
  const guardar = useGuardarConfigDte()
  const emisor = config.data?.emisor

  const [editado, setEditado] = useState<EdicionConfigDte>({})

  const valorDe = (clave: keyof EdicionConfigDte) => editado[clave] ?? valorGuardado(emisor, clave)

  const rutOk = validarRut(valorDe('rut'))
  // el rut que ya venia guardado puede ser invalido: eso se avisa, pero no bloquea el resto
  const rutTocado = editado.rut !== undefined
  const hayCambios = Object.keys(editado).some(
    (clave) => editado[clave as keyof EdicionConfigDte] !== valorGuardado(emisor, clave as keyof EdicionConfigDte),
  )

  const enviar = () => {
    // el sii recibe el rut sin puntos
    guardar.mutate({ ...editado, ...(editado.rut ? { rut: rutParaSii(editado.rut) } : {}) })
    setEditado({})
  }

  return (
    <Seccion
      titulo="Datos fiscales del local"
      descripcion="Se imprimen en el encabezado de las boletas y van firmados dentro del XML que se envia al SII."
      icono={<StorefrontOutlined />}
      origen="servidor"
    >
      {config.isPending ? (
        <Skeleton variant="rounded" height={200} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            }}
          >
            {CAMPOS.map((campo) => {
              const esRut = campo.clave === 'rut'
              const valor = valorDe(campo.clave)

              return (
                <TextField
                  key={campo.clave}
                  label={campo.etiqueta}
                  size="small"
                  value={valor}
                  onChange={(evento) =>
                    setEditado((previo) => ({
                      ...previo,
                      [campo.clave]: esRut ? formatearRut(evento.target.value) : evento.target.value,
                    }))
                  }
                  error={esRut && rutTocado && valor !== '' && !rutOk}
                  helperText={
                    esRut && valor !== '' && !rutOk
                      ? 'El digito verificador no cuadra (modulo 11)'
                      : campo.ayuda
                  }
                />
              )
            })}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              disabled={!hayCambios || (rutTocado && !rutOk) || guardar.isPending}
              onClick={enviar}
            >
              {guardar.isPending ? 'Guardando...' : 'Guardar datos fiscales'}
            </Button>
          </Box>
        </Box>
      )}

      {!config.isPending && !rutTocado && !rutOk && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          El RUT que trae el servidor no pasa la validacion del digito verificador. Va dentro de cada XML que se
          emite, asi que conviene corregirlo antes de usar el sistema de verdad.
        </Alert>
      )}

      {guardar.isSuccess && !hayCambios && (
        <Alert severity="success" sx={{ mt: 1 }}>
          {guardar.data.message}
        </Alert>
      )}

      {guardar.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {guardar.error.message}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Los documentos ya emitidos conservan los datos con que se timbraron. El local y el cajero de este equipo (
        {env.cajeroNombre}, {env.cajeroRol}) siguen saliendo del archivo <code>.env</code> del frontend.
      </Typography>
    </Seccion>
  )
}
