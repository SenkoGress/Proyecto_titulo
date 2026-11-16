// src/features/sii/components/compartidos/PanelCertificacion.tsx
import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined'
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined'
import ScienceOutlined from '@mui/icons-material/ScienceOutlined'
import { useCertificacion } from '@/features/sii/hooks/useSii'

// set de prueba tecnico que exige el sii para homologar el software
export function PanelCertificacion() {
  const certificacion = useCertificacion()
  const [confirmando, setConfirmando] = useState(false)

  const resultado = certificacion.data

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="warning">
        <AlertTitle sx={{ fontWeight: 700 }}>Esto emite documentos de verdad</AlertTitle>
        El set de prueba emite una boleta afecta, una boleta exenta y una nota de credito reales, y consume folios
        del CAF. Sirve para demostrar que el software cumple la Res. Ex. N° 74, no para uso diario.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <ScienceOutlined color="primary" />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Set de prueba tecnico (Res. Ex. N° 74)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Valida esquemas XML, timbre TED, firma XMLDSig y el reporte de consumo de folios.
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={certificacion.isPending ? <CircularProgress size={16} /> : <ScienceOutlined />}
            disabled={certificacion.isPending}
            onClick={() => setConfirmando(true)}
          >
            {certificacion.isPending ? 'Ejecutando...' : 'Ejecutar set de prueba'}
          </Button>
        </Box>
      </Paper>

      {certificacion.isError && <Alert severity="error">{certificacion.error.message}</Alert>}

      {resultado && (
        <>
          <Alert severity={resultado.success ? 'success' : 'error'}>
            <AlertTitle sx={{ fontWeight: 700 }}>
              {resultado.success ? 'Set de prueba aprobado' : 'Set de prueba con fallos'}
            </AlertTitle>
            {resultado.resumen}

            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
              Ambiente {resultado.ambiente} · {resultado.urlSii}
            </Typography>
          </Alert>

          {resultado.resultados.map((caso) => (
            <Paper
              key={caso.suiteName}
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                gap: 2,
                alignItems: 'flex-start',
                borderLeft: 4,
                borderLeftColor: caso.passed ? 'success.main' : 'error.main',
              }}
            >
              {caso.passed ? <CheckCircleOutlined color="success" /> : <ErrorOutlineOutlined color="error" />}

              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {caso.suiteName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {caso.detalles}
                </Typography>

                {caso.foliosGenerados.length > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Folios usados: {caso.foliosGenerados.join(', ')}
                  </Typography>
                )}
              </Box>

              <Chip
                label={caso.passed ? 'OK' : 'FALLO'}
                size="small"
                color={caso.passed ? 'success' : 'error'}
                sx={{ fontWeight: 700 }}
              />
            </Paper>
          ))}
        </>
      )}

      <Dialog open={confirmando} onClose={() => setConfirmando(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Ejecutar el set de prueba</DialogTitle>

        <DialogContent dividers>
          <Typography variant="body2">
            Se van a emitir tres documentos tributarios reales y se van a gastar folios del CAF. Esto no se puede
            deshacer. Los documentos van a aparecer en la lista de emitidos y en el F29.
          </Typography>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setConfirmando(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              setConfirmando(false)
              certificacion.mutate()
            }}
          >
            Ejecutar igual
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
