function escapeCSV(value: string | number | null): string {
  if (value === null) return ''
  const stringValue = String(value)
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`
  }
  return stringValue
}

/**
 * Converts an array of objects to CSV string
 */
export function toCSV(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map((header) => escapeCSV(header)).join(',')]
  for (const row of rows) {
    lines.push(row.map((value) => escapeCSV(value)).join(','))
  }
  return lines.join('\n')
}

/**
 * Triggers a CSV file download in the browser
 */
export function downloadCSV(filename: string, content: string): void {
  if (typeof window === 'undefined') return

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/**
 * Formats KES amount for CSV (no commas, just number)
 */
export function csvKES(amount: number): string {
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00'
}
