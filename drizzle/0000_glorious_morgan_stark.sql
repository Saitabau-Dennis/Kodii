CREATE TYPE "public"."collection_type" AS ENUM('paybill', 'till');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'deactivated');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('unpaid', 'partial', 'paid', 'overdue', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."notice_target" AS ENUM('all_tenants', 'property', 'unit', 'tenant');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('unpaid', 'pending_verification', 'paid', 'partial', 'overdue', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('landlord', 'caretaker');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'inactive', 'moved_out');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('water', 'electricity', 'plumbing', 'security', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('vacant', 'occupied', 'inactive');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "role" NOT NULL,
	"business_name" varchar(255),
	"invited_by" uuid,
	"invite_status" "invite_status",
	"phone_verified" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" text,
	"total_units" integer DEFAULT 0 NOT NULL,
	"caretaker_name" varchar(255),
	"caretaker_phone" varchar(20),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_number" varchar(50) NOT NULL,
	"monthly_rent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "unit_status" DEFAULT 'vacant' NOT NULL,
	"tenant_id" uuid,
	"payment_reference" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid,
	"full_name" varchar(255) NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"id_number" varchar(50),
	"move_in_date" date NOT NULL,
	"move_out_date" date,
	"rent_due_day" smallint DEFAULT 1 NOT NULL,
	"security_deposit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "rent_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" date NOT NULL,
	"status" "invoice_status" DEFAULT 'unpaid' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"invoice_id" uuid,
	"amount_expected" numeric(12, 2) NOT NULL,
	"amount_received" numeric(12, 2),
	"mpesa_code" varchar(20),
	"payer_phone" varchar(20),
	"payment_reference" varchar(100),
	"status" "payment_status" DEFAULT 'pending_verification' NOT NULL,
	"submitted_at" timestamp,
	"verified_at" timestamp,
	"verified_by" uuid,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "maintenance_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"tenant_id" uuid,
	"category" "ticket_category" NOT NULL,
	"description" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255),
	"message" text NOT NULL,
	"target_type" "notice_target" NOT NULL,
	"target_id" uuid,
	"sent_by" uuid NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"delivery_status" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "notice_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_id" uuid,
	"tenant_id" uuid,
	"from_phone" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"business_name" varchar(255),
	"app_url" varchar(255),
	"collection_type" "collection_type",
	"paybill_number" varchar(20),
	"till_number" varchar(20),
	"paybill_name" varchar(255),
	"till_name" varchar(255),
	"collection_account" varchar(20),
	"account_name" varchar(255),
	"account_number" varchar(255),
	"reference_rule" varchar(100),
	"default_due_day" smallint DEFAULT 1,
	"reminder_days_before" smallint DEFAULT 3,
	"enable_rent_reminders" boolean DEFAULT true NOT NULL,
	"remind_on_due_day" boolean DEFAULT true NOT NULL,
	"enable_overdue_reminders" boolean DEFAULT true NOT NULL,
	"overdue_reminder_frequency" smallint DEFAULT 7 NOT NULL,
	"overdue_max_reminders" smallint DEFAULT 3 NOT NULL,
	"notify_payment_confirmed" boolean DEFAULT true NOT NULL,
	"notify_payment_rejected" boolean DEFAULT true NOT NULL,
	"notify_ticket_status" boolean DEFAULT true NOT NULL,
	"notify_ticket_assigned" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "caretaker_properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caretaker_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_invoices" ADD CONSTRAINT "rent_invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_invoices" ADD CONSTRAINT "rent_invoices_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_rent_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."rent_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_maintenance_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."maintenance_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_replies" ADD CONSTRAINT "notice_replies_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_replies" ADD CONSTRAINT "notice_replies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caretaker_properties" ADD CONSTRAINT "caretaker_properties_caretaker_id_users_id_fk" FOREIGN KEY ("caretaker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caretaker_properties" ADD CONSTRAINT "caretaker_properties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caretaker_properties" ADD CONSTRAINT "caretaker_properties_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;