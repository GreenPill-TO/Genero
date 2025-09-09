import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { updateSession } from './shared/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';

vi.mock('@supabase/ssr');

function mockSupabase(user: any, value: string) {
  (createServerClient as unknown as vi.Mock).mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { value } }),
    }),
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  vi.resetAllMocks();
  vi.spyOn(NextResponse, 'next').mockReturnValue(new NextResponse());
});

describe('dashboard access control', () => {
  it('allows unauthenticated access when flag is false', async () => {
    mockSupabase(null, 'false');
    const url = new URL('http://example.com/dashboard');
    const req = {
      cookies: { getAll: () => [], set: () => {} },
      nextUrl: Object.assign(url, { clone: () => new URL(url.toString()) }),
    } as any;
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });

  it('redirects when flag is true', async () => {
    mockSupabase(null, 'true');
    const url = new URL('http://example.com/dashboard');
    const req = {
      cookies: { getAll: () => [], set: () => {} },
      nextUrl: Object.assign(url, { clone: () => new URL(url.toString()) }),
    } as any;
    const res = await updateSession(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://example.com/');
  });
});
