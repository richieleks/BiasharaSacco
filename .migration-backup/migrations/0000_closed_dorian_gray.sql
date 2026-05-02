CREATE TABLE "amortization_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"payment_number" integer NOT NULL,
	"payment_date" timestamp NOT NULL,
	"principal_amount" numeric(15, 2) NOT NULL,
	"interest_amount" numeric(15, 2) NOT NULL,
	"total_payment" numeric(15, 2) NOT NULL,
	"outstanding_balance" numeric(15, 2) NOT NULL,
	"status" varchar DEFAULT 'pending',
	"actual_payment_date" timestamp,
	"actual_amount_paid" numeric(15, 2),
	"late_fee" numeric(15, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"member_id" integer,
	"action" varchar NOT NULL,
	"resource" varchar NOT NULL,
	"resource_id" varchar,
	"details" text,
	"ip_address" varchar,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"savings_account_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"balance" numeric(15, 2) NOT NULL,
	"financial_year_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "balance_snapshots_savings_account_id_snapshot_date_unique" UNIQUE("savings_account_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "financial_years" (
	"id" serial PRIMARY KEY NOT NULL,
	"year_label" varchar NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false,
	"interest_rate" numeric(5, 4) DEFAULT '0.0500',
	"status" varchar DEFAULT 'draft',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "financial_years_year_label_unique" UNIQUE("year_label")
);
--> statement-breakpoint
CREATE TABLE "guarantors" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid(),
	"loan_id" integer NOT NULL,
	"guarantor_member_id" integer NOT NULL,
	"guarantee_amount" numeric(15, 2) NOT NULL,
	"status" varchar DEFAULT 'pending',
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"comments" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "guarantors_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "guarantors_loan_member_unique" UNIQUE("loan_id","guarantor_member_id")
);
--> statement-breakpoint
CREATE TABLE "interest_calculations" (
	"id" serial PRIMARY KEY NOT NULL,
	"financial_year_id" integer NOT NULL,
	"savings_account_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"calculation_date" date NOT NULL,
	"period_start_date" date NOT NULL,
	"period_end_date" date NOT NULL,
	"average_balance" numeric(15, 2) NOT NULL,
	"interest_rate" numeric(5, 4) NOT NULL,
	"gross_interest" numeric(15, 2) NOT NULL,
	"tax_amount" numeric(15, 2) DEFAULT '0.00',
	"net_interest" numeric(15, 2) NOT NULL,
	"status" varchar DEFAULT 'calculated',
	"calculation_method" varchar DEFAULT 'simple',
	"notes" text,
	"calculated_by" varchar,
	"approved_by" varchar,
	"approved_at" timestamp,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interest_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"interest_calculation_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"savings_account_id" integer NOT NULL,
	"payment_amount" numeric(15, 2) NOT NULL,
	"payment_method" varchar DEFAULT 'credit_to_account',
	"payment_date" date NOT NULL,
	"transaction_reference" varchar,
	"status" varchar DEFAULT 'pending',
	"processed_by" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interest_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_type" varchar NOT NULL,
	"base_rate" numeric(5, 2) NOT NULL,
	"compounding_frequency" varchar DEFAULT 'monthly',
	"is_active" boolean DEFAULT true,
	"minimum_amount" numeric(15, 2),
	"maximum_amount" numeric(15, 2),
	"minimum_term" integer,
	"maximum_term" integer,
	"effective_date" timestamp DEFAULT now(),
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"approved_by" varchar NOT NULL,
	"stage" varchar NOT NULL,
	"comments" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_interest_calculations" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_id" integer NOT NULL,
	"calculation_type" varchar NOT NULL,
	"principal" numeric(15, 2) NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"time" numeric(10, 4) NOT NULL,
	"compounding_periods" integer,
	"calculated_interest" numeric(15, 2) NOT NULL,
	"formula" varchar(100),
	"calculation_date" timestamp DEFAULT now(),
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "loan_terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"loan_type_id" integer NOT NULL,
	"term_name" varchar(100) NOT NULL,
	"term_category" varchar NOT NULL,
	"description" text NOT NULL,
	"is_required" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"interest_rate" numeric(6, 3) NOT NULL,
	"interest_type" varchar DEFAULT 'reducing_balance',
	"compounding_frequency" varchar DEFAULT 'monthly',
	"min_amount" numeric(12, 2) DEFAULT '0',
	"max_amount" numeric(12, 2),
	"min_term" integer DEFAULT 1,
	"max_term" integer DEFAULT 60,
	"grace_period" integer DEFAULT 0,
	"late_fee_rate" numeric(5, 2) DEFAULT '2.00',
	"processing_fee" numeric(5, 2) DEFAULT '0',
	"acceptance_fee" numeric(12, 2) DEFAULT '0',
	"requires_guarantor" boolean DEFAULT true,
	"guarantor_ratio" numeric(3, 2) DEFAULT '1.50',
	"min_repayments_for_top_up" integer DEFAULT 3,
	"is_active" boolean DEFAULT true,
	"approval_workflow" varchar DEFAULT 'multi_stage',
	"requires_collateral" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "loan_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid(),
	"member_id" integer NOT NULL,
	"loan_number" varchar NOT NULL,
	"loan_type" varchar DEFAULT 'personal',
	"principal_amount" numeric(15, 2) NOT NULL,
	"interest_rate" numeric(5, 4) NOT NULL,
	"term_months" integer NOT NULL,
	"monthly_payment" numeric(15, 2) NOT NULL,
	"outstanding_balance" numeric(15, 2) NOT NULL,
	"max_allowed_amount" numeric(15, 2),
	"savings_to_loan_ratio" numeric(5, 2),
	"status" varchar DEFAULT 'pending',
	"approval_stage" varchar DEFAULT 'committee',
	"teller_approved_by" varchar,
	"teller_approved_at" timestamp,
	"teller_comments" text,
	"committee_approved_by" varchar,
	"committee_approved_at" timestamp,
	"committee_comments" text,
	"manager_approved_by" varchar,
	"manager_approved_at" timestamp,
	"manager_comments" text,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"purpose" text,
	"average_net_pay" numeric(15, 2),
	"staff_number" varchar,
	"staff_account_number" varchar,
	"next_of_kin" varchar,
	"next_of_kin_phone" varchar,
	"is_top_up" boolean DEFAULT false,
	"top_up_of_loan_id" integer,
	"previous_loan_balance" numeric(15, 2),
	"current_savings" numeric(15, 2),
	"security_offered" text,
	"repayment_schedule_attached" boolean DEFAULT false,
	"application_date" timestamp DEFAULT now(),
	"approval_date" timestamp,
	"disbursement_date" timestamp,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "loans_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "loans_loan_number_unique" UNIQUE("loan_number")
);
--> statement-breakpoint
CREATE TABLE "member_exit_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"requested_by" varchar NOT NULL,
	"requested_at" timestamp DEFAULT now(),
	"reason" text,
	"status" varchar DEFAULT 'pending_treasurer',
	"exit_fee" numeric(15, 2) DEFAULT '0',
	"savings_used_for_loan_repayment" boolean DEFAULT false,
	"loan_amount_repaid" numeric(15, 2),
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_by" varchar,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"treasurer_comments" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "member_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"member_id" integer NOT NULL,
	"role" varchar NOT NULL,
	"assigned_by" varchar,
	"assigned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid(),
	"user_id" varchar,
	"member_number" varchar NOT NULL,
	"full_name" varchar DEFAULT '',
	"id_number" varchar NOT NULL,
	"date_of_birth" varchar DEFAULT '2000-01-01',
	"gender" varchar DEFAULT 'male',
	"phone_number" varchar NOT NULL,
	"member_email" varchar,
	"address" text,
	"marital_status" varchar DEFAULT 'single',
	"department" varchar DEFAULT '',
	"section" varchar,
	"terms_of_service" varchar DEFAULT 'permanent',
	"average_net_pay" numeric(15, 2),
	"staff_account_number" varchar,
	"monthly_savings" numeric(15, 2) DEFAULT '0',
	"account_number" varchar,
	"branch" varchar,
	"share_contribution" numeric(15, 2) DEFAULT '20000',
	"number_of_shares" integer DEFAULT 4,
	"beneficiary_name" varchar DEFAULT '',
	"beneficiary_relationship" varchar DEFAULT '',
	"beneficiary_contact" varchar DEFAULT '',
	"next_of_kin_name" varchar,
	"next_of_kin_phone" varchar,
	"role" varchar DEFAULT 'member',
	"status" varchar DEFAULT 'pending',
	"last_savings_date" timestamp,
	"exited_at" timestamp,
	"exit_reason" text,
	"exit_fee_charged" numeric(15, 2),
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"approval_comments" text,
	"join_date" timestamp DEFAULT now(),
	"membership_start_date" timestamp DEFAULT now(),
	"last_activity_date" timestamp,
	"share_capital" numeric(15, 2) DEFAULT '0',
	"total_savings" numeric(15, 2) DEFAULT '0',
	"is_fully_paid_shareholder" boolean DEFAULT false,
	"is_active_saver" boolean DEFAULT false,
	"is_paid_up" boolean DEFAULT false,
	"has_active_loans" boolean DEFAULT false,
	"is_defaulter" boolean DEFAULT false,
	"is_guarantor_for_defaulter" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "members_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "members_member_number_unique" UNIQUE("member_number"),
	CONSTRAINT "members_id_number_unique" UNIQUE("id_number")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"member_id" integer,
	"type" varchar NOT NULL,
	"title" varchar NOT NULL,
	"message" text NOT NULL,
	"priority" varchar DEFAULT 'medium',
	"is_read" boolean DEFAULT false,
	"action_url" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sacco_account_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"mapping_key" varchar NOT NULL,
	"mapping_label" varchar NOT NULL,
	"category" varchar NOT NULL,
	"description" text,
	"debit_account_id" integer,
	"credit_account_id" integer,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sacco_account_mappings_mapping_key_unique" UNIQUE("mapping_key")
);
--> statement-breakpoint
CREATE TABLE "sacco_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" varchar DEFAULT gen_random_uuid() NOT NULL,
	"account_code" varchar NOT NULL,
	"account_name" varchar NOT NULL,
	"account_type" varchar NOT NULL,
	"parent_account_id" integer,
	"description" text,
	"balance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system_account" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sacco_accounts_account_code_unique" UNIQUE("account_code")
);
--> statement-breakpoint
CREATE TABLE "sacco_journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" varchar DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" varchar NOT NULL,
	"entry_date" date NOT NULL,
	"description" text NOT NULL,
	"reference" varchar,
	"debit_account_id" integer NOT NULL,
	"credit_account_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_by" varchar NOT NULL,
	"status" varchar DEFAULT 'posted' NOT NULL,
	"reversed_by_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "sacco_journal_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "savings_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid(),
	"member_id" integer NOT NULL,
	"account_number" varchar NOT NULL,
	"account_type" varchar DEFAULT 'regular',
	"balance" numeric(15, 2) DEFAULT '0.00',
	"interest_rate" numeric(5, 4) DEFAULT '0.0000',
	"status" varchar DEFAULT 'active',
	"first_deposit_date" timestamp,
	"is_gradually_built_up" boolean DEFAULT true,
	"last_deposit_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "savings_accounts_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "savings_accounts_account_number_unique" UNIQUE("account_number")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" varchar NOT NULL,
	"setting_value" text NOT NULL,
	"setting_type" varchar DEFAULT 'string',
	"description" text,
	"updated_at" timestamp DEFAULT now(),
	"updated_by" varchar,
	CONSTRAINT "system_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid(),
	"member_id" integer NOT NULL,
	"savings_account_id" integer,
	"loan_id" integer,
	"transaction_type" varchar NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"description" text,
	"reference_number" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"processed_by" varchar,
	"transaction_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "transactions_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "transactions_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"settings_json" text DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"username" varchar,
	"password" varchar,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar DEFAULT 'member',
	"auth_method" varchar DEFAULT 'local',
	"must_change_password" boolean DEFAULT false,
	"failed_login_attempts" integer DEFAULT 0,
	"locked_until" timestamp,
	"two_factor_secret" varchar,
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "amortization_schedules" ADD CONSTRAINT "amortization_schedules_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_savings_account_id_savings_accounts_id_fk" FOREIGN KEY ("savings_account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_financial_year_id_financial_years_id_fk" FOREIGN KEY ("financial_year_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_guarantor_member_id_members_id_fk" FOREIGN KEY ("guarantor_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_calculations" ADD CONSTRAINT "interest_calculations_financial_year_id_financial_years_id_fk" FOREIGN KEY ("financial_year_id") REFERENCES "public"."financial_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_calculations" ADD CONSTRAINT "interest_calculations_savings_account_id_savings_accounts_id_fk" FOREIGN KEY ("savings_account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_calculations" ADD CONSTRAINT "interest_calculations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_calculations" ADD CONSTRAINT "interest_calculations_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_calculations" ADD CONSTRAINT "interest_calculations_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_payments" ADD CONSTRAINT "interest_payments_interest_calculation_id_interest_calculations_id_fk" FOREIGN KEY ("interest_calculation_id") REFERENCES "public"."interest_calculations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_payments" ADD CONSTRAINT "interest_payments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_payments" ADD CONSTRAINT "interest_payments_savings_account_id_savings_accounts_id_fk" FOREIGN KEY ("savings_account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interest_payments" ADD CONSTRAINT "interest_payments_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_approvals" ADD CONSTRAINT "loan_approvals_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_approvals" ADD CONSTRAINT "loan_approvals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_interest_calculations" ADD CONSTRAINT "loan_interest_calculations_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_terms" ADD CONSTRAINT "loan_terms_loan_type_id_loan_types_id_fk" FOREIGN KEY ("loan_type_id") REFERENCES "public"."loan_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_teller_approved_by_users_id_fk" FOREIGN KEY ("teller_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_committee_approved_by_users_id_fk" FOREIGN KEY ("committee_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_manager_approved_by_users_id_fk" FOREIGN KEY ("manager_approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_exit_requests" ADD CONSTRAINT "member_exit_requests_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_exit_requests" ADD CONSTRAINT "member_exit_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_exit_requests" ADD CONSTRAINT "member_exit_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_exit_requests" ADD CONSTRAINT "member_exit_requests_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_roles" ADD CONSTRAINT "member_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacco_account_mappings" ADD CONSTRAINT "sacco_account_mappings_debit_account_id_sacco_accounts_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."sacco_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacco_account_mappings" ADD CONSTRAINT "sacco_account_mappings_credit_account_id_sacco_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."sacco_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacco_journal_entries" ADD CONSTRAINT "sacco_journal_entries_debit_account_id_sacco_accounts_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."sacco_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacco_journal_entries" ADD CONSTRAINT "sacco_journal_entries_credit_account_id_sacco_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."sacco_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sacco_journal_entries" ADD CONSTRAINT "sacco_journal_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_savings_account_id_savings_accounts_id_fk" FOREIGN KEY ("savings_account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_permission_resource_action" ON "permissions" USING btree ("resource","action");--> statement-breakpoint
CREATE INDEX "idx_role_permission" ON "role_permissions" USING btree ("role_id","permission_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");