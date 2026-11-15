CREATE TABLE businesses (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  singleton_key TEXT NOT NULL DEFAULT 'primary' UNIQUE CHECK (singleton_key = 'primary'),
  owner_user_id TEXT NOT NULL UNIQUE CHECK (length(trim(owner_user_id)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
--> statement-breakpoint
CREATE TABLE business_settings (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  business_name TEXT NOT NULL DEFAULT '' CHECK (length(business_name) <= 120),
  locale TEXT NOT NULL DEFAULT 'hu' CHECK (locale IN ('hu', 'en')),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  currency TEXT NOT NULL DEFAULT 'HUF' CHECK (currency = 'HUF'),
  timezone TEXT NOT NULL DEFAULT 'Europe/Budapest' CHECK (timezone = 'Europe/Budapest'),
  units TEXT NOT NULL DEFAULT 'metric' CHECK (units = 'metric'),
  electricity_price_per_kwh REAL CHECK (electricity_price_per_kwh BETWEEN 0 AND 100000000),
  water_price_per_cubic_meter REAL CHECK (water_price_per_cubic_meter BETWEEN 0 AND 100000000),
  labor_cost_per_hour REAL CHECK (labor_cost_per_hour BETWEEN 0 AND 100000000),
  equipment_replacement_months INTEGER NOT NULL DEFAULT 24 CHECK (typeof(equipment_replacement_months) = 'integer' AND equipment_replacement_months BETWEEN 1 AND 600),
  version INTEGER NOT NULL DEFAULT 1 CHECK (typeof(version) = 'integer' AND version > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (business_id)
);
--> statement-breakpoint
CREATE TABLE customers (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 160),
  phone_number TEXT NOT NULL CHECK (length(trim(phone_number)) BETWEEN 1 AND 40),
  email TEXT CHECK (email IS NULL OR length(email) <= 254),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, business_id)
);
--> statement-breakpoint
CREATE TABLE vehicles (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL,
  manufacturer TEXT NOT NULL CHECK (length(trim(manufacturer)) > 0),
  model TEXT NOT NULL CHECK (length(trim(model)) > 0),
  production_year INTEGER CHECK (production_year IS NULL OR (typeof(production_year) = 'integer' AND production_year BETWEEN 1886 AND 2200)),
  registration_number TEXT,
  color TEXT NOT NULL DEFAULT '',
  size_category TEXT NOT NULL DEFAULT 'medium' CHECK (size_category IN ('small', 'medium', 'large', 'extra_large')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, business_id),
  UNIQUE (id, customer_id, business_id),
  FOREIGN KEY (customer_id, business_id) REFERENCES customers(id, business_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE services (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  default_price_huf INTEGER CHECK (default_price_huf IS NULL OR (typeof(default_price_huf) = 'integer' AND default_price_huf >= 0)),
  expected_duration_minutes INTEGER CHECK (expected_duration_minutes IS NULL OR (typeof(expected_duration_minutes) = 'integer' AND expected_duration_minutes >= 0)),
  expected_materials_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(expected_materials_json)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, business_id)
);
--> statement-breakpoint
CREATE TABLE work_orders (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  job_status TEXT NOT NULL DEFAULT 'scheduled' CHECK (job_status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  scheduled_at TEXT,
  started_at TEXT,
  finished_at TEXT,
  price_huf INTEGER NOT NULL DEFAULT 0 CHECK (typeof(price_huf) = 'integer' AND price_huf >= 0),
  labor_minutes INTEGER NOT NULL DEFAULT 0 CHECK (typeof(labor_minutes) = 'integer' AND labor_minutes >= 0),
  water_liters REAL NOT NULL DEFAULT 0 CHECK (water_liters >= 0),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, business_id),
  FOREIGN KEY (customer_id, business_id) REFERENCES customers(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (vehicle_id, customer_id, business_id) REFERENCES vehicles(id, customer_id, business_id) ON DELETE RESTRICT,
  CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at)
);
--> statement-breakpoint
CREATE TABLE work_order_services (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  work_order_id TEXT NOT NULL,
  service_id TEXT,
  name_snapshot TEXT NOT NULL,
  price_huf INTEGER NOT NULL CHECK (typeof(price_huf) = 'integer' AND price_huf >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (work_order_id, business_id) REFERENCES work_orders(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (service_id, business_id) REFERENCES services(id, business_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE chemicals (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  brand TEXT NOT NULL DEFAULT '',
  product_name TEXT NOT NULL CHECK (length(trim(product_name)) > 0),
  category TEXT NOT NULL DEFAULT '',
  purchase_price_huf INTEGER CHECK (purchase_price_huf IS NULL OR (typeof(purchase_price_huf) = 'integer' AND purchase_price_huf >= 0)),
  container_volume_ml REAL CHECK (container_volume_ml > 0),
  available_quantity_ml REAL NOT NULL DEFAULT 0 CHECK (available_quantity_ml >= 0),
  minimum_stock_ml REAL NOT NULL DEFAULT 0 CHECK (minimum_stock_ml >= 0),
  dilution_water_parts REAL NOT NULL DEFAULT 0 CHECK (dilution_water_parts >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, business_id)
);
--> statement-breakpoint
CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  chemical_id TEXT NOT NULL,
  work_order_id TEXT,
  quantity_delta_ml REAL NOT NULL CHECK (quantity_delta_ml != 0),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'job_usage', 'adjustment', 'reversal')),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (business_id, idempotency_key),
  FOREIGN KEY (chemical_id, business_id) REFERENCES chemicals(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (work_order_id, business_id) REFERENCES work_orders(id, business_id) ON DELETE RESTRICT,
  CHECK (movement_type != 'job_usage' OR (work_order_id IS NOT NULL AND quantity_delta_ml < 0))
);
--> statement-breakpoint
CREATE TABLE equipment (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  purchase_price_huf INTEGER CHECK (purchase_price_huf IS NULL OR (typeof(purchase_price_huf) = 'integer' AND purchase_price_huf >= 0)),
  power_watts REAL NOT NULL DEFAULT 0 CHECK (power_watts >= 0),
  expected_useful_hours REAL CHECK (expected_useful_hours > 0),
  replacement_months INTEGER NOT NULL DEFAULT 24 CHECK (typeof(replacement_months) = 'integer' AND replacement_months BETWEEN 1 AND 600),
  accumulated_usage_minutes REAL NOT NULL DEFAULT 0 CHECK (accumulated_usage_minutes >= 0),
  maintenance_cost_huf INTEGER NOT NULL DEFAULT 0 CHECK (typeof(maintenance_cost_huf) = 'integer' AND maintenance_cost_huf >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, business_id)
);
--> statement-breakpoint
CREATE TABLE work_order_chemicals (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  work_order_id TEXT NOT NULL,
  chemical_id TEXT NOT NULL,
  concentrate_used_ml REAL NOT NULL CHECK (concentrate_used_ml > 0),
  unit_cost_huf_per_ml_snapshot REAL CHECK (unit_cost_huf_per_ml_snapshot >= 0),
  dilution_water_parts_snapshot REAL NOT NULL DEFAULT 0 CHECK (dilution_water_parts_snapshot >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (work_order_id, business_id) REFERENCES work_orders(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (chemical_id, business_id) REFERENCES chemicals(id, business_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE work_order_equipment (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  work_order_id TEXT NOT NULL,
  equipment_id TEXT NOT NULL,
  operating_minutes REAL NOT NULL CHECK (operating_minutes >= 0),
  power_watts_snapshot REAL NOT NULL CHECK (power_watts_snapshot >= 0),
  depreciation_huf_per_hour_snapshot REAL CHECK (depreciation_huf_per_hour_snapshot >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (work_order_id, business_id) REFERENCES work_orders(id, business_id) ON DELETE RESTRICT,
  FOREIGN KEY (equipment_id, business_id) REFERENCES equipment(id, business_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE work_order_expenses (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  work_order_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('consumable', 'laundry', 'additional')),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  amount_huf INTEGER NOT NULL CHECK (typeof(amount_huf) = 'integer' AND amount_huf >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (work_order_id, business_id) REFERENCES work_orders(id, business_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE work_order_cost_snapshots (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  work_order_id TEXT NOT NULL,
  calculation_version INTEGER NOT NULL CHECK (calculation_version > 0),
  revenue_huf INTEGER NOT NULL CHECK (typeof(revenue_huf) = 'integer' AND revenue_huf >= 0),
  chemical_cost_huf INTEGER NOT NULL CHECK (typeof(chemical_cost_huf) = 'integer' AND chemical_cost_huf >= 0),
  electricity_cost_huf INTEGER NOT NULL CHECK (typeof(electricity_cost_huf) = 'integer' AND electricity_cost_huf >= 0),
  water_cost_huf INTEGER NOT NULL CHECK (typeof(water_cost_huf) = 'integer' AND water_cost_huf >= 0),
  depreciation_cost_huf INTEGER NOT NULL CHECK (typeof(depreciation_cost_huf) = 'integer' AND depreciation_cost_huf >= 0),
  consumable_cost_huf INTEGER NOT NULL CHECK (typeof(consumable_cost_huf) = 'integer' AND consumable_cost_huf >= 0),
  additional_cost_huf INTEGER NOT NULL CHECK (typeof(additional_cost_huf) = 'integer' AND additional_cost_huf >= 0),
  labor_cost_huf INTEGER NOT NULL CHECK (typeof(labor_cost_huf) = 'integer' AND labor_cost_huf >= 0),
  settings_snapshot_json TEXT NOT NULL CHECK (json_valid(settings_snapshot_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (work_order_id, business_id),
  FOREIGN KEY (work_order_id, business_id) REFERENCES work_orders(id, business_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX customers_business_name_idx ON customers(business_id, full_name);
--> statement-breakpoint
CREATE INDEX vehicles_customer_idx ON vehicles(business_id, customer_id);
--> statement-breakpoint
CREATE INDEX work_orders_schedule_idx ON work_orders(business_id, scheduled_at);
--> statement-breakpoint
CREATE INDEX work_orders_customer_idx ON work_orders(business_id, customer_id);
--> statement-breakpoint
CREATE INDEX inventory_movements_chemical_idx ON inventory_movements(business_id, chemical_id, created_at);
