import type { DesignTokens } from '../../shared/types'
import { mergeTailwindClasses } from '../../shared/designTokens'

/** Chuyển key style camelCase → kebab-case (dùng cho thuộc tính HTML). */
export function camelToKebabCase(str: string): string {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase()
}

function parseSimpleObjectLiteral(body: string): Record<string, string> | null {
  const text = body.trim()
  if (!text) return {}
  if (text.includes('...') || text.includes('{') || text.includes('}') || text.includes('`')) return null
  const result: Record<string, string> = {}
  const entryRe = /(['"]?)([A-Za-z_][\w-]*)\1\s*:\s*(['"])(.*?)\3/g
  let match: RegExpExecArray | null
  while ((match = entryRe.exec(text)) !== null) {
    result[match[2]] = match[4]
  }
  const leftover = text
    .replace(/(['"]?)[A-Za-z_][\w-]*\1\s*:\s*(['"])(.*?)\2/g, '')
    .replace(/[,\s]/g, '')
  if (leftover.length > 0) return null
  return result
}

function escapeStyleValue(value: string): string {
  return JSON.stringify(value)
}

export interface TailwindLineUpdate {
  line: string
  modified: boolean
  /** Gặp className/style động — không thể ghi class an toàn. */
  unsafe: boolean
}

/**
 * Ghi class Tailwind vào `className` của JSX và chỉ giữ inline style cho phần
 * chưa chuyển được. Trả `unsafe: true` khi gặp biểu thức động.
 */
export function applyJsxTailwindAttributes(
  line: string,
  tagRegex: RegExp,
  addedClasses: string[],
  residualStyles: Record<string, string>,
  convertedProperties: string[],
  tokens: DesignTokens
): TailwindLineUpdate {
  let nextLine = line
  let modified = false

  const dynamicClass = /className\s*=\s*\{/.test(nextLine)
  const classRe =
    /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*"([^"]*)"\s*\}|\{\s*'([^']*)'\s*\}|\{\s*`([^`$]*)`\s*\})/
  const classMatch = nextLine.match(classRe)

  if (classMatch) {
    const existing = classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? classMatch[4] ?? classMatch[5] ?? ''
    const merged = mergeTailwindClasses(existing, addedClasses, tokens)
    nextLine = nextLine.replace(classRe, `className="${merged}"`)
    modified = true
  } else if (dynamicClass) {
    return { line, modified: false, unsafe: true }
  } else if (addedClasses.length > 0) {
    nextLine = nextLine.replace(tagRegex, `$1 className="${addedClasses.join(' ')}"$2`)
    modified = true
  }

  const dynamicStyle =
    /style\s*=\s*\{/.test(nextLine) && !/style\s*=\s*\{\{[^{}]*\}\}/.test(nextLine)
  if (dynamicStyle) {
    return { line: nextLine, modified, unsafe: true }
  }

  const simpleStyleRe = /style\s*=\s*\{\{([^{}]*)\}\}/
  const styleMatch = nextLine.match(simpleStyleRe)
  if (styleMatch) {
    const parsed = parseSimpleObjectLiteral(styleMatch[1])
    if (parsed === null) return { line: nextLine, modified, unsafe: true }
    const map = { ...parsed }
    for (const key of Object.keys(map)) {
      const normalized = camelToKebabCase(key)
      if (convertedProperties.some((property) => camelToKebabCase(property) === normalized)) {
        delete map[key]
      }
    }
    for (const [key, value] of Object.entries(residualStyles)) map[key] = value

    if (Object.keys(map).length === 0) {
      nextLine = nextLine.replace(/\s*style\s*=\s*\{\{[^{}]*\}\}/, '')
      modified = true
    } else {
      const styleBody = Object.entries(map)
        .map(([key, value]) => `${key}: ${escapeStyleValue(value)}`)
        .join(', ')
      nextLine = nextLine.replace(simpleStyleRe, `style={{ ${styleBody} }}`)
      modified = true
    }
  } else if (Object.keys(residualStyles).length > 0) {
    const styleBody = Object.entries(residualStyles)
      .map(([key, value]) => `${camelToKebabCase(key)}: ${escapeStyleValue(value)}`)
      .join(', ')
    nextLine = nextLine.replace(tagRegex, `$1 style={{ ${styleBody} }}$2`)
    modified = true
  }

  return { line: nextLine, modified, unsafe: false }
}

/**
 * Ghi class Tailwind vào `class` của HTML/CSHTML/Vue/Svelte và chỉ giữ inline
 * style cho phần chưa chuyển được. Trả `unsafe: true` khi gặp binding động.
 */
export function applyHtmlTailwindAttributes(
  line: string,
  tagRegex: RegExp,
  addedClasses: string[],
  residualStyles: Record<string, string>,
  convertedProperties: string[],
  tokens: DesignTokens
): TailwindLineUpdate {
  let nextLine = line
  let modified = false

  const dynamicClass = /(?:\bclass\s*=\s*\{|:class\s*=)/.test(nextLine)
  const classRe = /(?<![:.\w-])class(?:Name)?\s*=\s*("([^"]*)"|'([^']*)')/
  const classMatch = nextLine.match(classRe)

  if (classMatch) {
    const existing = classMatch[2] ?? classMatch[3] ?? ''
    const merged = mergeTailwindClasses(existing, addedClasses, tokens)
    nextLine = nextLine.replace(classRe, `class="${merged}"`)
    modified = true
  } else if (dynamicClass && addedClasses.length > 0) {
    return { line, modified: false, unsafe: true }
  } else if (addedClasses.length > 0) {
    nextLine = nextLine.replace(tagRegex, `$1 class="${addedClasses.join(' ')}"$2`)
    modified = true
  }

  const dynamicStyle = /(?::style\s*=)/.test(nextLine) || /style\s*=\s*\{\{/.test(nextLine)
  if (dynamicStyle) return { line: nextLine, modified, unsafe: true }

  const simpleStyleRe = /style\s*=\s*("([^"]*)"|'([^']*)')/
  const styleMatch = nextLine.match(simpleStyleRe)
  if (styleMatch) {
    const cssText = styleMatch[2] ?? styleMatch[3] ?? ''
    const map: Record<string, string> = {}
    for (const part of cssText.split(';')) {
      const colonIdx = part.indexOf(':')
      if (colonIdx === -1) continue
      const key = part.slice(0, colonIdx).trim().toLowerCase()
      const value = part.slice(colonIdx + 1).trim()
      if (key && value) map[key] = value
    }
    for (const key of Object.keys(map)) {
      if (convertedProperties.some((property) => camelToKebabCase(property) === key)) delete map[key]
    }
    for (const [key, value] of Object.entries(residualStyles)) {
      map[camelToKebabCase(key)] = value
    }

    if (Object.keys(map).length === 0) {
      nextLine = nextLine.replace(/\s*style\s*=\s*("[^"]*"|'[^']*')/, '')
      modified = true
    } else {
      const styleText = Object.entries(map)
        .map(([key, value]) => `${key}: ${value};`)
        .join(' ')
      nextLine = nextLine.replace(simpleStyleRe, `style="${styleText}"`)
      modified = true
    }
  } else if (Object.keys(residualStyles).length > 0) {
    const styleText = Object.entries(residualStyles)
      .map(([key, value]) => `${camelToKebabCase(key)}: ${value};`)
      .join(' ')
    nextLine = nextLine.replace(tagRegex, `$1 style="${styleText}"$2`)
    modified = true
  }

  return { line: nextLine, modified, unsafe: false }
}
