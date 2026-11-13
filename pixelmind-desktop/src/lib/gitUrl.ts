export const parseRepoNameFromUrl = (url: string): string => {
  const clean = url.trim().replace(/\/+$/, '')
  if (!clean) return ''
  const lastPart = clean.split('/').pop() || ''
  return lastPart.replace(/\.git$/i, '').replace(/[/\\:*?"<>|]/g, '-').trim()
}
