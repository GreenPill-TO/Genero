import { describe, expect, it } from 'vitest'
import { shouldRequireAuth, fetchRequireAuth } from './useRequireAuthOnDashboard'

describe('shouldRequireAuth', () => {
  it('returns true for truthy values', () => {
    expect(shouldRequireAuth('true')).toBe(true)
    expect(shouldRequireAuth('TRUE')).toBe(true)
    expect(shouldRequireAuth(1)).toBe(true)
    expect(shouldRequireAuth('1')).toBe(true)
    expect(shouldRequireAuth(true)).toBe(true)
  })

  it('returns false for other values', () => {
    expect(shouldRequireAuth('false')).toBe(false)
    expect(shouldRequireAuth(false)).toBe(false)
    expect(shouldRequireAuth(0)).toBe(false)
    expect(shouldRequireAuth('0')).toBe(false)
    expect(shouldRequireAuth(undefined)).toBe(false)
  })
})

describe('fetchRequireAuth', () => {
  it('returns false when fetch fails', async () => {
    const result = await fetchRequireAuth(async () => {
      throw new Error('RLS policy')
    })
    expect(result).toBe(false)
  })

  it('parses fetched value', async () => {
    const result = await fetchRequireAuth(async () => ({ data: { value: '1' }, error: null }))
    expect(result).toBe(true)
  })
})
