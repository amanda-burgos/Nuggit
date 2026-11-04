import type { BrainDumpResult } from '../../shared/types'
import { t } from '../../shared/i18n'
import { loadSettings } from '../storage'
import { brainDump } from './agents'
import { text } from './agents/types'
import { askAgent, errorMessage } from './index'

// SPEC 9.6: the Brain Dump agent splits the text into tasks and notes. Nothing is saved
// here: the interface shows them to review. The text only goes to the AI when the person
// presses "Ordenar con Dip".

const MAX_TEXT = 6000

export async function splitBrainDump(input: unknown): Promise<BrainDumpResult> {
  const dump = text(input, MAX_TEXT)
  if (!dump)
    return {
      ok: false,
      error: t('Escribe primero lo que tienes en la cabeza.', "First write what's on your mind.")
    }
  try {
    const settings = await loadSettings()
    const { value } = await askAgent(brainDump, 'split', { personality: settings.dipPersonality }, [
      { role: 'user', content: `Lo que soltó la persona:\n"""\n${dump}\n"""` }
    ])
    return { ok: true, ...value }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}
