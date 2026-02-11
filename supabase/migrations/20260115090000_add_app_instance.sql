-- interac_transfer
ALTER TABLE public.interac_transfer
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

UPDATE public.interac_transfer
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

ALTER TABLE public.interac_transfer
  ALTER COLUMN app_instance_id SET NOT NULL;

ALTER TABLE public.interac_transfer
  ADD CONSTRAINT interac_transfer_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

ALTER TABLE public.interac_transfer
  DROP CONSTRAINT IF EXISTS interac_transfer_id_app_instance_key;

ALTER TABLE public.interac_transfer
  ADD CONSTRAINT interac_transfer_id_app_instance_key UNIQUE (id, app_instance_id);

CREATE INDEX IF NOT EXISTS interac_transfer_app_instance_id_idx
  ON public.interac_transfer(app_instance_id);

CREATE INDEX IF NOT EXISTS interac_transfer_user_app_idx
  ON public.interac_transfer(user_id, app_instance_id);


-- off_ramp_req
ALTER TABLE public.off_ramp_req
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

UPDATE public.off_ramp_req
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

ALTER TABLE public.off_ramp_req
  ALTER COLUMN app_instance_id SET NOT NULL;

ALTER TABLE public.off_ramp_req
  ADD CONSTRAINT off_ramp_req_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

ALTER TABLE public.off_ramp_req
  DROP CONSTRAINT IF EXISTS off_ramp_req_id_app_instance_key;

ALTER TABLE public.off_ramp_req
  ADD CONSTRAINT off_ramp_req_id_app_instance_key UNIQUE (id, app_instance_id);

CREATE INDEX IF NOT EXISTS off_ramp_req_app_instance_id_idx
  ON public.off_ramp_req(app_instance_id);

CREATE INDEX IF NOT EXISTS off_ramp_req_user_app_idx
  ON public.off_ramp_req(user_id, app_instance_id);


-- act_transactions

ALTER TABLE public.act_transactions ADD COLUMN IF NOT EXISTS app_instance_id bigint;

UPDATE public.act_transactions
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

ALTER TABLE public.act_transactions
  ALTER COLUMN app_instance_id SET NOT NULL;

ALTER TABLE public.act_transactions
  ADD CONSTRAINT act_transactions_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

ALTER TABLE public.act_transactions
  DROP CONSTRAINT IF EXISTS act_transactions_id_app_instance_key;

ALTER TABLE public.act_transactions
  ADD CONSTRAINT act_transactions_id_app_instance_key UNIQUE (id, app_instance_id);

ALTER TABLE public.act_transactions
  DROP CONSTRAINT IF EXISTS act_transactions_onramp_request_id_fkey;

ALTER TABLE public.act_transactions
  DROP CONSTRAINT IF EXISTS act_transactions_offramp_request_id_fkey;

ALTER TABLE public.act_transactions
  ADD CONSTRAINT act_transactions_onramp_app_instance_fkey
  FOREIGN KEY (onramp_request_id, app_instance_id)
  REFERENCES public.interac_transfer(id, app_instance_id);

ALTER TABLE public.act_transactions
  ADD CONSTRAINT act_transactions_offramp_app_instance_fkey
  FOREIGN KEY (offramp_request_id, app_instance_id)
  REFERENCES public.off_ramp_req(id, app_instance_id);

CREATE INDEX IF NOT EXISTS act_transactions_app_instance_id_idx
  ON public.act_transactions(app_instance_id);

CREATE INDEX IF NOT EXISTS act_transactions_user_app_instance_idx
  ON public.act_transactions(created_by, app_instance_id);


-- notifications simplified migration (force app_instance_id = 3)

-- 1) Add column
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill
UPDATE public.notifications
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Enforce NOT NULL
ALTER TABLE public.notifications
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Replace old FK to act_transactions with composite FK
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_trx_entry_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_trx_entry_app_instance_fkey
  FOREIGN KEY (trx_entry_id, app_instance_id)
  REFERENCES public.act_transactions(id, app_instance_id);

-- 6) Indexes for performance
CREATE INDEX IF NOT EXISTS notifications_app_instance_id_idx
  ON public.notifications(app_instance_id);

CREATE INDEX IF NOT EXISTS notifications_user_app_idx
  ON public.notifications(user_id, app_instance_id);

-- app_admin_notifications simplified migration (force app_instance_id = 3)

-- 1) Column
ALTER TABLE public.app_admin_notifications
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill
UPDATE public.app_admin_notifications
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Not null
ALTER TABLE public.app_admin_notifications
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.app_admin_notifications
  ADD CONSTRAINT app_admin_notifications_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Indexes
CREATE INDEX IF NOT EXISTS app_admin_notifications_app_instance_id_idx
  ON public.app_admin_notifications(app_instance_id);

CREATE INDEX IF NOT EXISTS app_admin_notifications_user_app_idx
  ON public.app_admin_notifications(user_id, app_instance_id);


-- STORES (force app_instance_id = 3)

-- 1) Column
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill
UPDATE public.stores
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Not null
ALTER TABLE public.stores
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.stores
  ADD CONSTRAINT stores_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Per-instance uniqueness (so other tables can reference (id, app_instance_id))
ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_id_app_instance_key;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_id_app_instance_key UNIQUE (id, app_instance_id);

-- 6) Indexes
CREATE INDEX IF NOT EXISTS stores_app_instance_id_idx
  ON public.stores(app_instance_id);



-- STORE EMPLOYEES (force app_instance_id = 3)

-- 1) Column
ALTER TABLE public.store_employees
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill
UPDATE public.store_employees
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Not null
ALTER TABLE public.store_employees
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.store_employees
  ADD CONSTRAINT store_employees_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Primary key scoped per instance
ALTER TABLE public.store_employees
  DROP CONSTRAINT IF EXISTS store_employees_pkey;

ALTER TABLE public.store_employees
  ADD CONSTRAINT store_employees_pkey
  PRIMARY KEY (store_id, user_id, app_instance_id);

-- 6) Optional: FK to stores within the same instance
-- (valid because we added UNIQUE (id, app_instance_id) on public.stores above)
ALTER TABLE public.store_employees
  DROP CONSTRAINT IF EXISTS store_employees_store_app_instance_fkey;

ALTER TABLE public.store_employees
  ADD CONSTRAINT store_employees_store_app_instance_fkey
  FOREIGN KEY (store_id, app_instance_id)
  REFERENCES public.stores(id, app_instance_id);

-- 7) Indexes
CREATE INDEX IF NOT EXISTS store_employees_app_instance_id_idx
  ON public.store_employees(app_instance_id);

CREATE INDEX IF NOT EXISTS store_employees_store_app_idx
  ON public.store_employees(store_id, app_instance_id);


-- ============================
-- INVOICE_PAY_REQUEST
-- ============================

-- 1) Column
ALTER TABLE public.invoice_pay_request
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill
UPDATE public.invoice_pay_request
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Not null
ALTER TABLE public.invoice_pay_request
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.invoice_pay_request
  ADD CONSTRAINT invoice_pay_request_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Per-instance uniqueness (so act_transactions can reference (id, app_instance_id) if needed)
ALTER TABLE public.invoice_pay_request
  DROP CONSTRAINT IF EXISTS invoice_pay_request_id_app_instance_key;

ALTER TABLE public.invoice_pay_request
  ADD CONSTRAINT invoice_pay_request_id_app_instance_key UNIQUE (id, app_instance_id);

-- 6) Composite FK to act_transactions (replace single-column FK if present)
ALTER TABLE public.invoice_pay_request
  DROP CONSTRAINT IF EXISTS invoice_pay_request_transaction_id_fkey;

ALTER TABLE public.invoice_pay_request
  ADD CONSTRAINT invoice_pay_request_transaction_app_instance_fkey
  FOREIGN KEY (transaction_id, app_instance_id)
  REFERENCES public.act_transactions(id, app_instance_id);

-- 7) Indexes
CREATE INDEX IF NOT EXISTS invoice_pay_request_app_instance_id_idx
  ON public.invoice_pay_request(app_instance_id);

CREATE INDEX IF NOT EXISTS invoice_pay_request_requester_app_idx
  ON public.invoice_pay_request(request_from, app_instance_id);



-- ============================
-- CONNECTIONS
-- ============================

-- 1) Column
ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill
UPDATE public.connections
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Not null
ALTER TABLE public.connections
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.connections
  ADD CONSTRAINT connections_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Indexes (including per-instance uniqueness)
CREATE INDEX IF NOT EXISTS connections_app_instance_id_idx
  ON public.connections(app_instance_id);

CREATE INDEX IF NOT EXISTS connections_owner_app_idx
  ON public.connections(owner_user_id, app_instance_id);

CREATE INDEX IF NOT EXISTS connections_connected_app_idx
  ON public.connections(connected_user_id, app_instance_id);

CREATE UNIQUE INDEX IF NOT EXISTS connections_owner_connected_app_idx
  ON public.connections(owner_user_id, connected_user_id, app_instance_id);


-- INVITES (force app_instance_id = 3)

-- 1) Column
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill existing rows
UPDATE public.invites
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Not null
ALTER TABLE public.invites
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.invites
  ADD CONSTRAINT invites_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Per-instance uniqueness for tokens
ALTER TABLE public.invites
  DROP CONSTRAINT IF EXISTS invites_token_key;

ALTER TABLE public.invites
  ADD CONSTRAINT invites_token_app_instance_key
  UNIQUE (token, app_instance_id);

-- (Keep existing user FKs as-is; users table is global)
--   constraint fk_invites_from_user foreign key (from_user_id) references users (id)
--   constraint fk_invites_used_by_user foreign key (used_by_user_id) references users (id)

-- 6) Indexes
CREATE INDEX IF NOT EXISTS invites_app_instance_id_idx
  ON public.invites(app_instance_id);

CREATE INDEX IF NOT EXISTS invites_from_user_app_idx
  ON public.invites(from_user_id, app_instance_id);

CREATE INDEX IF NOT EXISTS invites_used_by_user_app_idx
  ON public.invites(used_by_user_id, app_instance_id);

-- existing index retained:
--   idx_invites_expires_at on (expires_at)

-- ROLES (force app_instance_id = 3)

-- 1) Column
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill existing rows
UPDATE public.roles
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Not null
ALTER TABLE public.roles
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.roles
  ADD CONSTRAINT roles_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Scope the primary key per app instance
ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_pkey;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_pkey
  PRIMARY KEY (user_id, role, app_instance_id);

-- 6) Keep the unique identity key
-- (already exists): roles_id_key UNIQUE (sequential_id)

-- 7) Keep existing foreign keys (users, ref_roles) as-is
--   roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id)
--   roles_role_fkey        FOREIGN KEY (role)        REFERENCES ref_roles(role)
--   roles_user_id_fkey     FOREIGN KEY (user_id)     REFERENCES users(id)

-- 8) Indexes for common filters
CREATE INDEX IF NOT EXISTS roles_app_instance_id_idx
  ON public.roles(app_instance_id);

CREATE INDEX IF NOT EXISTS roles_user_app_idx
  ON public.roles(user_id, app_instance_id);

CREATE INDEX IF NOT EXISTS roles_role_app_idx
  ON public.roles(role, app_instance_id);


-- User_requests

-- 1) Column
ALTER TABLE public.user_requests
  ADD COLUMN IF NOT EXISTS app_instance_id bigint;

-- 2) Backfill
UPDATE public.user_requests
SET app_instance_id = 3
WHERE app_instance_id IS NULL;

-- 3) Not null
ALTER TABLE public.user_requests
  ALTER COLUMN app_instance_id SET NOT NULL;

-- 4) FK to app instances
ALTER TABLE public.user_requests
  ADD CONSTRAINT user_requests_app_instance_id_fkey
  FOREIGN KEY (app_instance_id) REFERENCES public.ref_app_instances(id);

-- 5) Indexes
CREATE INDEX IF NOT EXISTS user_requests_app_instance_id_idx
  ON public.user_requests(app_instance_id);

CREATE INDEX IF NOT EXISTS user_requests_email_app_idx
  ON public.user_requests(email, app_instance_id);

CREATE INDEX IF NOT EXISTS user_requests_created_at_app_idx
  ON public.user_requests(created_at, app_instance_id);

