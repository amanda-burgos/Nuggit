// "¿La guardo?" → "sí": answering Dip's proposals by voice (SPEC 9.10). Only short answers
// count; anything longer ("no, mejor el viernes") goes to Dip as a normal message.

const YES =
  /^(si|sip|claro|dale|ok|okay|va|vale|sale|guardala|guardalo|hazlo|correcto|exacto|perfecto|de acuerdo|por favor|yes|yeah|yep|sure|please|do it)\b/
const NO = /^(no|nop|nel|nah|cancela|cancelala|cancelalo|mejor no|no gracias|nope|dont)\b/

export function yesOrNo(text: string): 'yes' | 'no' | null {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!words || words.split(' ').length > 4) return null
  if (NO.test(words)) return 'no'
  if (YES.test(words)) return 'yes'
  return null
}
