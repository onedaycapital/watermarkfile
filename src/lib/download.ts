/**
 * Trigger a file download from a URL (fetch → blob → object URL → click).
 * Falls back to opening the URL in a new tab if fetch fails.
 */
export function triggerDownload(url: string, filename: string): void {
  const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
  fetch(absoluteUrl, { method: 'GET' })
    .then((r) => {
      if (!r.ok) throw new Error('Download failed')
      return r.blob()
    })
    .then((blob) => {
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = filename || 'download'
      a.rel = 'noopener noreferrer'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(u), 500)
    })
    .catch(() => {
      window.open(absoluteUrl, '_blank', 'noopener,noreferrer')
    })
}
