/**
 * Trims a number string to a maximum number of decimals
 * @param value - number as string
 * @param maxDecimals - maximum decimals to keep
 * @returns string with trimmed decimals
 */
export function trimDecimals(value: string, maxDecimals: number): string {
  if (!value.includes('.')) return value
  const [intPart, decPart] = value.split('.')
  if (decPart.length <= maxDecimals) return value
  return `${intPart}.${decPart.slice(0, maxDecimals)}`
}
