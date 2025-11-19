import { isAddress, type Address } from "viem"

export const isValidAddress = (address: string): address is Address => {
  if (!address || typeof address !== "string") {
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
  return !address || address.trim() === ""
}
