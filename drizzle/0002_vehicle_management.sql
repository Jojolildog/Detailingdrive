ALTER TABLE vehicles ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (typeof(version) = 'integer' AND version > 0);
--> statement-breakpoint
CREATE INDEX vehicles_business_created_idx ON vehicles(business_id, created_at DESC, id);
--> statement-breakpoint
CREATE INDEX vehicles_business_size_year_idx ON vehicles(business_id, size_category, production_year);
