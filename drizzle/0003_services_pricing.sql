ALTER TABLE services ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (typeof(version) = 'integer' AND version > 0);
--> statement-breakpoint
ALTER TABLE services ADD COLUMN optional_cost_estimate_huf INTEGER CHECK (optional_cost_estimate_huf IS NULL OR (typeof(optional_cost_estimate_huf) = 'integer' AND optional_cost_estimate_huf BETWEEN 0 AND 100000000));
--> statement-breakpoint
ALTER TABLE services ADD COLUMN service_type TEXT NOT NULL DEFAULT 'single' CHECK (service_type IN ('single', 'bundle'));
--> statement-breakpoint
CREATE UNIQUE INDEX services_id_business_type_idx ON services(id, business_id, service_type);
--> statement-breakpoint
CREATE INDEX services_business_active_name_idx ON services(business_id, active, name);
--> statement-breakpoint
CREATE INDEX services_business_price_idx ON services(business_id, default_price_huf);
--> statement-breakpoint
CREATE TABLE service_bundle_items (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  bundle_service_id TEXT NOT NULL,
  component_service_id TEXT NOT NULL,
  bundle_type TEXT NOT NULL DEFAULT 'bundle' CHECK (bundle_type = 'bundle'),
  component_type TEXT NOT NULL DEFAULT 'single' CHECK (component_type = 'single'),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (typeof(quantity) = 'integer' AND quantity BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (bundle_service_id, component_service_id, business_id),
  CHECK (bundle_service_id <> component_service_id),
  FOREIGN KEY (bundle_service_id, business_id, bundle_type) REFERENCES services(id, business_id, service_type) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (component_service_id, business_id, component_type) REFERENCES services(id, business_id, service_type) ON DELETE RESTRICT ON UPDATE RESTRICT
);
--> statement-breakpoint
CREATE INDEX service_bundle_components_idx ON service_bundle_items(business_id, component_service_id);
