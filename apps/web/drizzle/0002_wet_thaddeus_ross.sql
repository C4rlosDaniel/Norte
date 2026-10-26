CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('delivery', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'pix');--> statement-breakpoint
CREATE TYPE "public"."print_job_status" AS ENUM('pending', 'processing', 'printed', 'failed', 'canceled');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_task_kind" AS ENUM('order_confirmation');--> statement-breakpoint
CREATE TYPE "public"."whatsapp_task_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "order_status" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_item_modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"group_name" text NOT NULL,
	"option_name" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_item_modifiers_price_non_negative" CHECK ("order_item_modifiers"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"modifiers_total_cents" integer DEFAULT 0 NOT NULL,
	"line_total_cents" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_unit_price_non_negative" CHECK ("order_items"."unit_price_cents" >= 0),
	CONSTRAINT "order_items_modifiers_total_non_negative" CHECK ("order_items"."modifiers_total_cents" >= 0),
	CONSTRAINT "order_items_line_total_non_negative" CHECK ("order_items"."line_total_cents" >= 0),
	CONSTRAINT "order_items_line_total_matches" CHECK ("order_items"."line_total_cents" = ("order_items"."unit_price_cents" + "order_items"."modifiers_total_cents") * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"order_number" integer NOT NULL,
	"link_code" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"type" "order_type" NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"address_street" text DEFAULT '' NOT NULL,
	"address_number" text DEFAULT '' NOT NULL,
	"address_complement" text DEFAULT '' NOT NULL,
	"address_district" text DEFAULT '' NOT NULL,
	"address_reference" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"delivery_fee_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"change_for_cents" integer,
	"cancel_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	CONSTRAINT "orders_number_positive" CHECK ("orders"."order_number" > 0),
	CONSTRAINT "orders_subtotal_non_negative" CHECK ("orders"."subtotal_cents" >= 0),
	CONSTRAINT "orders_delivery_fee_non_negative" CHECK ("orders"."delivery_fee_cents" >= 0),
	CONSTRAINT "orders_total_non_negative" CHECK ("orders"."total_cents" >= 0),
	CONSTRAINT "orders_total_matches" CHECK ("orders"."total_cents" = "orders"."subtotal_cents" + "orders"."delivery_fee_cents"),
	CONSTRAINT "orders_change_for_covers_total" CHECK ("orders"."change_for_cents" IS NULL OR "orders"."change_for_cents" >= "orders"."total_cents")
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "print_job_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text DEFAULT '' NOT NULL,
	"leased_by" text,
	"lease_expires_at" timestamp with time zone,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "print_jobs_attempts_non_negative" CHECK ("print_jobs"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "whatsapp_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "whatsapp_task_kind" NOT NULL,
	"status" "whatsapp_task_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text DEFAULT '' NOT NULL,
	"scheduled_for" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_tasks_attempts_non_negative" CHECK ("whatsapp_tasks"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_tasks" ADD CONSTRAINT "whatsapp_tasks_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_tasks" ADD CONSTRAINT "whatsapp_tasks_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_events_order_created_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_item_modifiers_item_sort_idx" ON "order_item_modifiers" USING btree ("order_item_id","sort_order");--> statement-breakpoint
CREATE INDEX "order_items_order_sort_idx" ON "order_items" USING btree ("order_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_restaurant_number_key" ON "orders" USING btree ("restaurant_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_restaurant_idempotency_key" ON "orders" USING btree ("restaurant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_link_code_key" ON "orders" USING btree ("link_code");--> statement-breakpoint
CREATE INDEX "orders_restaurant_created_idx" ON "orders" USING btree ("restaurant_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_restaurant_status_created_idx" ON "orders" USING btree ("restaurant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "print_jobs_restaurant_status_created_idx" ON "print_jobs" USING btree ("restaurant_id","status","created_at");--> statement-breakpoint
CREATE INDEX "print_jobs_order_idx" ON "print_jobs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "whatsapp_tasks_restaurant_status_scheduled_idx" ON "whatsapp_tasks" USING btree ("restaurant_id","status","scheduled_for");--> statement-breakpoint
CREATE INDEX "whatsapp_tasks_order_idx" ON "whatsapp_tasks" USING btree ("order_id");