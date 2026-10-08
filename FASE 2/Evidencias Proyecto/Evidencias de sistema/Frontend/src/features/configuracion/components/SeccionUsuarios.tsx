// src/features/configuracion/components/SeccionUsuarios.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import PeopleOutlined from '@mui/icons-material/PeopleAltOutlined'
import PersonAddOutlined from '@mui/icons-material/PersonAddAlt1Outlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { useUsuarios } from '@/features/auth/hooks/useAuth'
import { useUsuario } from '@/features/auth/stores/sesionStore'
import { nombreRol } from '@/features/auth/utils/permisos'
import { DialogoNuevoUsuario } from '@/features/auth/components/DialogoNuevoUsuario'

// quienes pueden entrar al sistema en este local
export function SeccionUsuarios() {
  const [agregando, setAgregando] = useState(false)
  const usuarios = useUsuarios()
  const yo = useUsuario()

  return (
    <Seccion
      titulo="Personas del local"
      descripcion="Quienes pueden entrar al sistema y con que permisos."
      icono={<PeopleOutlined />}
      origen="servidor"
    >
      {usuarios.isError && <ErrorBox error={usuarios.error} />}
      {usuarios.isPending && <Skeleton variant="rounded" height={120} />}

      {usuarios.isSuccess && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {usuarios.data.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Todavia no hay nadie mas registrado.
            </Typography>
          )}

          {usuarios.data.map((usuario) => (
            <Box
              key={usuario.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                {usuario.nombre.charAt(0)}
              </Avatar>

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {usuario.nombre}
                  {usuario.id === yo?.id && (
                    <Typography variant="caption" color="text.secondary" component="span">
                      {' '}
                      (tu)
                    </Typography>
                  )}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {usuario.email}
                </Typography>
              </Box>

              <Chip
                size="small"
                label={nombreRol(usuario.rol)}
                color={usuario.rol === 'admin' ? 'primary' : 'default'}
                variant="outlined"
              />
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<PersonAddOutlined />}
          onClick={() => setAgregando(true)}
        >
          Agregar persona
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Cada persona entra con su propio correo, asi queda registrado quien hizo cada venta y cada
        ajuste de stock.
      </Typography>

      <DialogoNuevoUsuario
        key={agregando ? 'abierto' : 'cerrado'}
        abierto={agregando}
        onCerrar={() => setAgregando(false)}
      />
    </Seccion>
  )
}
