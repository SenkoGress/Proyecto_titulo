// src/shared/utils/imprimirDocumento.ts

// Imprime sin abrir una ventana. Con window.open('') la URL queda en about:blank, y la aplicacion
// de escritorio manda todo lo que se abre al sistema operativo: Windows recibe "about:" y responde
// que no tiene con que abrirlo. Un iframe oculto imprime igual y no sale de la aplicacion.
export function imprimirDocumento(html: string): void {
  const marco = document.createElement('iframe')
  marco.setAttribute('aria-hidden', 'true')
  marco.style.position = 'fixed'
  marco.style.right = '0'
  marco.style.bottom = '0'
  marco.style.width = '0'
  marco.style.height = '0'
  marco.style.border = '0'

  document.body.appendChild(marco)

  const documento = marco.contentWindow?.document
  if (!documento) {
    marco.remove()
    return
  }

  documento.open()
  documento.write(html)
  documento.close()

  // quitar el marco despues de imprimir, sin dejarlo pegado si el dialogo se cancela
  const terminar = () => {
    setTimeout(() => marco.remove(), 1000)
  }

  const imprimir = () => {
    try {
      marco.contentWindow?.focus()
      marco.contentWindow?.print()
    } finally {
      terminar()
    }
  }

  // las imagenes del comprobante tienen que estar cargadas antes de imprimir
  if (documento.readyState === 'complete') imprimir()
  else marco.onload = imprimir
}
