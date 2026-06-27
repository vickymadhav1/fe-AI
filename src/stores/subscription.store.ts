import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { InvisibleOrderResponse, InvisibleSubscription } from '@/types'

export const useSubscriptionStore = defineStore('subscription', {
  state: () => ({
    subscription: null as InvisibleSubscription | null,
    loading: false,
    creatingOrder: false,
    verifyingPayment: false,
    deductingCredits: false,
    invisibleModeActive: false,
    error: '',
    paymentStatus: '',
  }),

  getters: {
    active: (state) => Boolean(state.subscription?.active),
    remainingMinutes: (state) => state.subscription?.remainingMinutes ?? 0,
    remainingCredits: (state) => state.subscription?.remainingCredits ?? 0,
  },

  actions: {
    async load() {
      this.loading = true
      this.error = ''
      try {
        this.subscription = await api.getInvisibleSubscription()
        if (!this.subscription.active) this.invisibleModeActive = false
      } catch {
        this.error = 'Could not load Invisible subscription.'
      } finally {
        this.loading = false
      }
    },

    async createOrder(planId = 'invisible_starter'): Promise<InvisibleOrderResponse> {
      this.creatingOrder = true
      this.paymentStatus = 'Payment Pending'
      this.error = ''
      try {
        const response = await api.createInvisibleOrder(planId)
        this.subscription = response.subscription
        return response
      } catch {
        this.paymentStatus = 'Payment Failed'
        this.error = 'Could not create Razorpay order.'
        throw new Error(this.error)
      } finally {
        this.creatingOrder = false
      }
    },

    async verifyPayment(payload: {
      razorpayOrderId: string
      razorpayPaymentId: string
      razorpaySignature: string
    }) {
      this.verifyingPayment = true
      this.paymentStatus = 'Verifying Payment'
      this.error = ''
      try {
        this.subscription = await api.verifyInvisiblePayment(payload)
        this.paymentStatus = 'Payment Successful'
      } catch {
        this.paymentStatus = 'Payment Failed'
        this.error = 'Payment verification failed.'
        throw new Error(this.error)
      } finally {
        this.verifyingPayment = false
      }
    },

    async markPaymentFailed(orderId: string, reason: string) {
      this.paymentStatus = 'Payment Failed'
      this.subscription = await api.failInvisiblePayment({
        razorpayOrderId: orderId,
        reason,
      })
    },

    async deductMinute() {
      if (!this.subscription?.active || this.deductingCredits) return
      this.deductingCredits = true
      try {
        this.subscription = await api.deductInvisibleCredits(1)
        if (!this.subscription.active || this.subscription.remainingCredits <= 0) {
          this.invisibleModeActive = false
          this.paymentStatus = 'Exhausted'
        }
      } finally {
        this.deductingCredits = false
      }
    },

    async setProtection(enabled: boolean) {
      this.subscription = await api.setInvisibleProtection(enabled)
    },

    setInvisibleMode(active: boolean) {
      this.invisibleModeActive = active && Boolean(this.subscription?.active)
    },
  },
})
