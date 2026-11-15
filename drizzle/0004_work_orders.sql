ALTER TABLE work_orders ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (typeof(version) = 'integer' AND version > 0);
--> statement-breakpoint
ALTER TABLE work_orders ADD COLUMN write_token TEXT;
--> statement-breakpoint
CREATE INDEX work_orders_business_schedule_idx ON work_orders(business_id, scheduled_at, id);
--> statement-breakpoint
CREATE INDEX work_orders_business_status_idx ON work_orders(business_id, job_status, payment_status);
--> statement-breakpoint
CREATE INDEX work_orders_business_customer_idx ON work_orders(business_id, customer_id);
--> statement-breakpoint
CREATE INDEX work_order_services_order_idx ON work_order_services(business_id, work_order_id);
