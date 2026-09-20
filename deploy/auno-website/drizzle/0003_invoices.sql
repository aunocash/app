ALTER TABLE payments ADD COLUMN invoice_id text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY NOT NULL,
  public_id text NOT NULL,
  merchant_wallet text NOT NULL,
  invoice_number text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  customer_email text NOT NULL DEFAULT '',
  accounting_currency text NOT NULL,
  subtotal text NOT NULL,
  discount_type text NOT NULL DEFAULT 'none',
  discount_value text NOT NULL DEFAULT '0',
  discount_amount text NOT NULL DEFAULT '0',
  tax_label text NOT NULL DEFAULT '',
  tax_rate text NOT NULL DEFAULT '0',
  tax_amount text NOT NULL DEFAULT '0',
  additional_fees text NOT NULL DEFAULT '0',
  total_amount text NOT NULL,
  items text NOT NULL,
  recipient_wallet text NOT NULL,
  accepted_assets text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT',
  issue_date text NOT NULL,
  due_date text NOT NULL,
  terms text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  published_at integer,
  paid_at integer,
  voided_at integer,
  paid_payment_id text,
  creation_key text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS invoice_public_id_idx ON invoices (public_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invoice_merchant_created_idx ON invoices (merchant_wallet, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS invoice_status_updated_idx ON invoices (status, updated_at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS invoice_creation_key_idx ON invoices (creation_key);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS invoice_merchant_number_idx ON invoices (merchant_wallet, invoice_number);
