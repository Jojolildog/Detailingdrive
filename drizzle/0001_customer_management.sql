ALTER TABLE customers ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (typeof(version) = 'integer' AND version > 0);
--> statement-breakpoint
CREATE INDEX customers_business_created_idx ON customers(business_id, created_at DESC, id);
