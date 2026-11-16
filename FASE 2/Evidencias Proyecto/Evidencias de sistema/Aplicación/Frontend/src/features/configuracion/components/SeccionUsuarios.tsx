// src/features/configuracion/components/SeccionUsuarios.tsx
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import PeopleOutlined from '@mui/icons-material/PeopleAltOutlined'
import PersonAddOutlined from '@mui/icons-material/PersonAddAlt1Outlined'
import PersonRemoveOutlined from '@mui/icons-material/PersonRemoveAlt1Outlined'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { Seccion } from '@/features/configuracion/components/Seccion'
import { ErrorBox } from '@/shared/components/ui/ErrorBox'
import { obtenerMensajeError } from '@/lib/api/apiError'
import { useEditarUsuario, useUsuarios } from '@/features/auth/hooks/useAuth'
import { useUsuario } from '@/features/auth/stores/sesionStore'
import { nombreRol } from '@/features/auth/utils/permisos'
import { DialogoNuevoUsuario } from '@/features/auth/components/DialogoNuevoUsuario'
import { DialogoEditarUsuario } from '@/features/auth/components/DialogoEditarUsuario'
import { DialogoBajaUsuario } from '@/features/auth/components/DialogoBajaUsuario'
import type { Usuario } from '@/features/auth/types'

// quienes pueden entrar al sistema en este local
export function SeccionUsuarios() {
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [dandoDeBaja, setDandoDeBaja] = useState<Usuario | null>(null)
  const usuarios = useUsuarios()
  const yo = useUsuario()
  const reactivar = useEditarUsuario()

  const estaActivo = (usuario: Usuario) => usuario.activo !== 0

  // el backend rechaza dejar el local sin administrador, y conviene avisarlo antes de intentarlo
  const adminsActivos = (usuarios.data ?? []).filter((u) => u.rol === 'admin' && estaActivo(u)).length

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
              <Avatar
                sx={{ width: 32, height: 32, fontSize: 14, opacity: estaActivo(usuario) ? 1 : 0.4 }}
              >
                {usuario.nombre.charAt(0)}
              </Avatar>

              <Box sx={{ flexGrow: 1, minWidth: 0, opacity: estaActivo(usuario) ? 1 : 0.6 }}>
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

              {!estaActivo(usuario) && (
                <Chip size="small" label="Dado de baja" color="default" variant="filled" />
              )}

              <Chip
                size="small"
                label={nombreRol(usuario.rol)}
                color={usuario.rol === 'admin' ? 'primary' : 'default'}
                variant="outlined"
              />

              {estaActivo(usuario) ? (
                <>
                  <Tooltip title="Editar sus datos">
                    <IconButton size="small" onClick={() => setEditando(usuario)}>
                      <EditOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>

                  {/* nadie puede darse de baja a si mismo: el backend responde 409 */}
                  <Tooltip
                    title={usuario.id === yo?.id ? 'No puedes darte de baja a ti mismo' : 'Dar de baja'}
                  >
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setDandoDeBaja(usuario)}
                        disabled={usuario.id === yo?.id}
                      >
                        <PersonRemoveOutlined fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => reactivar.mutate({ id: usuario.id, cambios: { activo: true } })}
                  disabled={reactivar.isPending}
                >
                  Reactivar
                </Button>
              )}
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

      {reactivar.isError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {obtenerMensajeError(reactivar.error)}
        </Alert>
      )}

      <DialogoNuevoUsuario
        key={agregando ? 'abierto' : 'cerrado'}
        abierto={agregando}
        onCerrar={() => setAgregando(false)}
      />

      {editando && (
        <DialogoEditarUsuario
          usuario={editando}
          esElUltimoAdmin={editando.rol === 'admin' && adminsActivos <= 1}
          onCerrar={() => setEditando(null)}
        />
      )}

      {dandoDeBaja && (
        <DialogoBajaUsuario usuario={dandoDeBaja} onCerrar={() => setDandoDeBaja(null)} />
      )}
    </Seccion>
  )
}
