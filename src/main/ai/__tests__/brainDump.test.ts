import { describe, expect, it } from 'vitest'
import { brainDump } from '../agents/brainDump'

const check = brainDump.tasks.split.check

describe('brain dump agent', () => {
  it('keeps tasks and notes, dropping empty ones', () => {
    const raw = JSON.stringify({
      tasks: [
        { title: 'Estudiar para mate', dueDate: '2030-01-10', priority: 'high' },
        { title: '  ', dueDate: '', priority: '' }
      ],
      notes: ['Idea para la feria', '']
    })
    expect(check(raw)).toEqual({
      ok: true,
      value: {
        tasks: [{ title: 'Estudiar para mate', dueDate: '2030-01-10', priority: 'high' }],
        notes: ['Idea para la feria']
      }
    })
  })

  it('asks the agent to fix bad dates and an empty split', () => {
    const badDate = check(
      JSON.stringify({ tasks: [{ title: 'x', dueDate: 'viernes' }], notes: [] })
    )
    expect(badDate.ok).toBe(false)
    if (!badDate.ok) expect(badDate.error).toContain('AAAA-MM-DD')
    const empty = check(JSON.stringify({ tasks: [], notes: [] }))
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.error).toContain('vacíos')
  })
})
