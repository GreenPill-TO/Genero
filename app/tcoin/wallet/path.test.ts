import { describe, it, expect } from 'vitest'
import { walletRelativePath } from './path'

describe('walletRelativePath', () => {
  it('removes wallet base path', () => {
    expect(walletRelativePath('/tcoin/wallet/dashboard')).toBe('/dashboard')
    expect(walletRelativePath('/tcoin/wallet')).toBe('/')
    expect(walletRelativePath('/tcoin/wallet/resources')).toBe('/resources')
  })
})

