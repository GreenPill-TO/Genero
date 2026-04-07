# Todo

## Future Ideas

- Revisit passcode send/verify transport behind one shared server boundary instead of splitting behaviour between direct browser Supabase auth calls and ad hoc API routes.
  Consider a Supabase Edge Function or a common server-side helper that both wallet and SpareChange can reuse.
  Preserve the current post-OTP requirement that verification returns or establishes a usable session quickly enough for the browser auth bootstrap to reuse the fresh access token without reintroducing the earlier `401` race.
  If this is pursued, carry over the stronger error-handling and test coverage ideas from the older `codex/fix-toast-error-on-signup-modal` branch rather than reviving that branch wholesale.
