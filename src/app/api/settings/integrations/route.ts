import { NextResponse } from 'next/server'
import { TAX_SOFTWARE, COUNTRIES } from '@/lib/constants'

export async function GET() {
  return NextResponse.json({
    taxSoftware: TAX_SOFTWARE,
    countries: COUNTRIES,
  })
}
