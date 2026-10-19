// DATA-001: ISO 4217 currencies and their minor-unit exponents. The list is the
// active ISO 4217 table (2026) plus codes withdrawn since 2023 so earlier
// invoices stay readable (HRK, ANG, BGN, SLL, ZWL). Codes without a minor unit
// (metals, XDR, XSU, XUA, the X-B bond units, XTS and XXX) are refused.
const EXPONENT_0 = 'BIF CLP DJF GNF ISK JPY KMF KRW PYG RWF UGX UYI VND VUV XAF XOF XPF'
const EXPONENT_3 = 'BHD IQD JOD KWD LYD OMR TND'
const EXPONENT_4 = 'CLF UYW'
const EXPONENT_2 = 'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CNY COP COU CRC CUP CVE CZK DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IRR JMD KES KGS KHR KPW KYD KZT LAK LBP LKR LRD LSL MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD PAB PEN PGK PHP PKR PLN QAR RON RSD RUB SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TOP TRY TTD TWD TZS UAH USD USN UYU UZS VED VES WST XCD XCG YER ZAR ZMW ZWG ZWL'
const exponents = new Map<string, number>([[EXPONENT_0, 0], [EXPONENT_2, 2], [EXPONENT_3, 3], [EXPONENT_4, 4]].flatMap(([codes, digits]) => String(codes).split(' ').map(code => [code, Number(digits)] as [string, number])))
export const minorUnitDigits = (currency: string) => exponents.get(currency)
export const isCurrency = (currency: string) => exponents.has(currency)
/** Exact decimal text for integer minor units, e.g. KWD 1500 -> "1.500", JPY 1500 -> "1500". */
export function majorAmount(minor: number, currency: string) {
 const digits = minorUnitDigits(currency) ?? 2, sign = minor < 0 ? '-' : '', text = String(Math.abs(minor)).padStart(digits + 1, '0')
 return digits ? `${sign}${text.slice(0, -digits)}.${text.slice(-digits)}` : `${sign}${text}`
}
