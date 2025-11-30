import { Address, isAddress } from 'viem'

export const isValidDecimal = (value: string): boolean => {
  if (!value || value.trim() === '') {
    return true
  }

  const decimalRegex = /^\d*\.?\d*$/
  if (!decimalRegex.test(value)) {
    return false
  }

  const num = parseFloat(value)
  return !isNaN(num) && isFinite(num) && num >= 0
}

export const formatDecimalInput = (value: string): string => {
  let formatted = value.replace(/[^0-9.]/g, '')

  const parts = formatted.split('.')
  if (parts.length > 2) {
    formatted = parts[0] + '.' + parts.slice(1).join('')
  }

  if (formatted.length > 1 && formatted[0] === '0' && formatted[1] !== '.') {
    formatted = formatted.replace(/^0+/, '')
  }

  return formatted
}

export const isValidAddressFormat = (value: string): boolean => {
  if (!value || value.trim() === '') {
    return true
  }

  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export const isValidAddress = (address: string): address is Address => {
  if (!address || typeof address !== 'string') {
    return false
  }

  return isAddress(address)
}

export const validateAndChecksumAddress = (address: string): Address | null => {
  if (!isValidAddress(address)) {
    return null
  }

  try {
    return address as Address
  } catch {
    return null
  }
}

export const isEmptyAddress = (address: string): boolean => {
  return !address || address.trim() === ''
}
