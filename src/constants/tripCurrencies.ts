export type TripCurrencyOption = {
  value: string
  label: string
  region?: string
}

export const tripCurrencyOptions: TripCurrencyOption[] = [
  { value: 'JPY', label: 'JPY 日圓', region: '日本' },
  { value: 'KRW', label: 'KRW 韓元', region: '韓國' },
  { value: 'TWD', label: 'TWD 新台幣', region: '台灣' },
  { value: 'HKD', label: 'HKD 港幣', region: '香港' },
  { value: 'CNY', label: 'CNY 人民幣', region: '中國' },
  { value: 'MOP', label: 'MOP 澳門幣', region: '澳門' },
  { value: 'THB', label: 'THB 泰銖', region: '泰國' },
  { value: 'VND', label: 'VND 越南盾', region: '越南' },
  { value: 'SGD', label: 'SGD 新加坡幣', region: '新加坡' },
  { value: 'MYR', label: 'MYR 馬來西亞令吉', region: '馬來西亞' },
  { value: 'PHP', label: 'PHP 菲律賓披索', region: '菲律賓' },
  { value: 'IDR', label: 'IDR 印尼盾', region: '印尼' },
  { value: 'USD', label: 'USD 美元', region: '美國' },
  { value: 'CAD', label: 'CAD 加拿大幣', region: '加拿大' },
  { value: 'AUD', label: 'AUD 澳幣', region: '澳洲' },
  { value: 'NZD', label: 'NZD 紐西蘭幣', region: '紐西蘭' },
  { value: 'GBP', label: 'GBP 英鎊', region: '英國' },
  { value: 'EUR', label: 'EUR 歐元', region: '歐洲' },
  { value: 'CHF', label: 'CHF 瑞士法郎', region: '瑞士' },
]

export function normalizeTripCurrency(code?: string) {
  return code?.trim().toUpperCase() || ''
}

export function tripCurrencyDisplay(code?: string) {
  const normalized = normalizeTripCurrency(code)
  return (
    tripCurrencyOptions.find((option) => option.value === normalized)?.label ||
    normalized
  )
}
