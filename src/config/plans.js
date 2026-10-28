// Atur limit dan harga plan di sini.
// dailyLimit   = jumlah request API per hari (reset 00:00 WIB)
// jadibotSlots = jumlah nomor jadibot yang boleh dipasang
// price & days dipakai nanti di Tahap 2 (pembayaran)
export const plans = {
  free: { id: 'free', name: 'Free', dailyLimit: 100, jadibotSlots: 1, price: 0, days: 0 },
  premium: { id: 'premium', name: 'Premium', dailyLimit: 1000, jadibotSlots: 3, price: 15000, days: 30 },
  vip: { id: 'vip', name: 'VIP', dailyLimit: 10000, jadibotSlots: 10, price: 50000, days: 30 }
}

export const PLAN_IDS = Object.keys(plans)
