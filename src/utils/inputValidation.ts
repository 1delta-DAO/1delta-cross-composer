export const isValidDecimal = (value: string): boolean => {
  if (!value || value.trim() === "") {
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
  let formatted = value.replace(/[^0-9.]/g, "")

  const parts = formatted.split(".")
  if (parts.length > 2) {
    formatted = parts[0] + "." + parts.slice(1).join("")
  }

  if (formatted.length > 1 && formatted[0] === "0" && formatted[1] !== ".") {
    formatted = formatted.replace(/^0+/, "")
  }

  return formatted
}

export const isValidAddressFormat = (value: string): boolean => {
  if (!value || value.trim() === "") {
    return true
  }

  return /^0x[a-fA-F0-9]{40}$/.test(value)
}
