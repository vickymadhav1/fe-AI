const sanitizeConfigValue = (value?: string): string => {
  return value?.trim().replace(/^['"]|['"]$/g, '').replace(/,+$/g, '').trim() ?? ''
}

export const razorpayConfig = {
  keyId: sanitizeConfigValue(import.meta.env.VITE_RAZORPAY_KEY_ID),
  checkoutUrl: 'https://checkout.razorpay.com/v1/checkout.js',
} as const

export const logRazorpayFrontendConfigStatus = (): void => {
  console.info(`[Razorpay] Frontend Key Loaded: ${razorpayConfig.keyId ? 'Yes' : 'No'}`)
}

export const requireRazorpayFrontendKey = (): string => {
  if (!razorpayConfig.keyId) {
    throw new Error('Missing Razorpay configuration:\n\nVITE_RAZORPAY_KEY_ID')
  }
  return razorpayConfig.keyId
}
