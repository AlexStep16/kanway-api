import fs from 'fs'
import path from 'path'

interface ExchangeRateData {
  usdToRub: number
  transferCommissionMultiplier: number
  updatedAt: string
}

const RATE_FILE_PATH = path.join(process.cwd(), 'data', 'exchangeRate.json')

// 2% transfer commission from Russia by default
const DEFAULT_RATE: ExchangeRateData = {
  usdToRub: 87.5,
  transferCommissionMultiplier: 1.02,
  updatedAt: new Date().toISOString(),
}

let cachedRate: ExchangeRateData = { ...DEFAULT_RATE }

function loadRateFromFile(): void {
  try {
    const raw = fs.readFileSync(RATE_FILE_PATH, 'utf-8')
    cachedRate = JSON.parse(raw) as ExchangeRateData
  } catch {
    // Keep defaults if the file is missing or malformed
  }
}

export async function updateAndSaveRate(): Promise<void> {
  const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js')
  if (!response.ok) throw new Error(`CBR API responded with status ${response.status}`)

  const data = (await response.json()) as { Valute: { USD: { Value: number } } }
  const usdToRub = data.Valute.USD.Value

  cachedRate = {
    ...cachedRate,
    usdToRub,
    updatedAt: new Date().toISOString(),
  }

  fs.writeFileSync(RATE_FILE_PATH, JSON.stringify(cachedRate, null, 2), 'utf-8')
}

export function getEffectiveUsdToRubRate(): number {
  return cachedRate.usdToRub * cachedRate.transferCommissionMultiplier
}

loadRateFromFile()
