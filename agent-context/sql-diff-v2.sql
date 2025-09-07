-- UP
CREATE TABLE IF NOT EXISTS user_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  email text,
  message text,
  ip_addresses text[],
  created_at timestamp with time zone DEFAULT now()
);

-- DOWN
DROP TABLE IF EXISTS user_requests;
