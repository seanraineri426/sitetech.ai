export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = {
	public: {
		Tables: {
			audit_log: {
				Row: {
					action: string;
					actor_type: string;
					actor_user_id: string | null;
					created_at: string;
					id: number;
					metadata: Json | null;
					org_id: string | null;
					target_id: string | null;
					target_table: string | null;
				};
				ComputedFields: never;
				Insert: {
					action: string;
					actor_type: string;
					actor_user_id?: string | null;
					created_at?: string;
					id?: never;
					metadata?: Json | null;
					org_id?: string | null;
					target_id?: string | null;
					target_table?: string | null;
				};
				Update: {
					action?: string;
					actor_type?: string;
					actor_user_id?: string | null;
					created_at?: string;
					id?: never;
					metadata?: Json | null;
					org_id?: string | null;
					target_id?: string | null;
					target_table?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "audit_log_actor_user_id_fkey";
						columns: ["actor_user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "audit_log_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
				];
			};
			emails: {
				Row: {
					body_preview: string | null;
					body_text: string | null;
					cc_addresses: string[];
					conversation_id: string | null;
					created_at: string;
					external_id: string;
					from_address: string;
					has_attachments: boolean;
					id: string;
					org_id: string;
					project_id: string;
					raw_record_id: string;
					received_at: string;
					received_at_source: Database["public"]["Enums"]["received_at_source"];
					subject: string;
					to_addresses: string[];
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					body_preview?: string | null;
					body_text?: string | null;
					cc_addresses?: string[];
					conversation_id?: string | null;
					created_at?: string;
					external_id: string;
					from_address: string;
					has_attachments?: boolean;
					id?: string;
					org_id: string;
					project_id: string;
					raw_record_id: string;
					received_at: string;
					received_at_source: Database["public"]["Enums"]["received_at_source"];
					subject: string;
					to_addresses?: string[];
					updated_at?: string;
				};
				Update: {
					body_preview?: string | null;
					body_text?: string | null;
					cc_addresses?: string[];
					conversation_id?: string | null;
					created_at?: string;
					external_id?: string;
					from_address?: string;
					has_attachments?: boolean;
					id?: string;
					org_id?: string;
					project_id?: string;
					raw_record_id?: string;
					received_at?: string;
					received_at_source?: Database["public"]["Enums"]["received_at_source"];
					subject?: string;
					to_addresses?: string[];
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "emails_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "emails_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
					{
						foreignKeyName: "emails_raw_record_fk";
						columns: ["raw_record_id", "org_id", "project_id"];
						isOneToOne: false;
						referencedRelation: "raw_records";
						referencedColumns: ["id", "org_id", "project_id"];
					},
				];
			};
			integration_connections: {
				Row: {
					created_at: string;
					created_by: string | null;
					disconnected_at: string | null;
					display_name: string;
					external_account_id: string;
					id: string;
					org_id: string;
					provider: Database["public"]["Enums"]["integration_provider"];
					status: Database["public"]["Enums"]["connection_status"];
					updated_at: string;
					vault_secret_id: string | null;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					created_by?: string | null;
					disconnected_at?: string | null;
					display_name: string;
					external_account_id: string;
					id?: string;
					org_id: string;
					provider: Database["public"]["Enums"]["integration_provider"];
					status?: Database["public"]["Enums"]["connection_status"];
					updated_at?: string;
					vault_secret_id?: string | null;
				};
				Update: {
					created_at?: string;
					created_by?: string | null;
					disconnected_at?: string | null;
					display_name?: string;
					external_account_id?: string;
					id?: string;
					org_id?: string;
					provider?: Database["public"]["Enums"]["integration_provider"];
					status?: Database["public"]["Enums"]["connection_status"];
					updated_at?: string;
					vault_secret_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "integration_connections_created_by_fkey";
						columns: ["created_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "integration_connections_org_id_fkey";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
				];
			};
			org_memberships: {
				Row: {
					created_at: string;
					org_id: string;
					role: string;
					user_id: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					org_id: string;
					role: string;
					user_id: string;
				};
				Update: {
					created_at?: string;
					org_id?: string;
					role?: string;
					user_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "org_memberships_org_id_fkey";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "org_memberships_user_id_fkey";
						columns: ["user_id"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
				];
			};
			orgs: {
				Row: {
					created_at: string;
					id: string;
					name: string;
					slug: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					id?: string;
					name: string;
					slug: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					name?: string;
					slug?: string;
				};
				Relationships: [];
			};
			profiles: {
				Row: {
					created_at: string;
					email: string | null;
					full_name: string | null;
					id: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					email?: string | null;
					full_name?: string | null;
					id: string;
				};
				Update: {
					created_at?: string;
					email?: string | null;
					full_name?: string | null;
					id?: string;
				};
				Relationships: [];
			};
			project_holidays: {
				Row: {
					created_at: string;
					holiday_date: string;
					id: string;
					label: string;
					org_id: string;
					project_id: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					holiday_date: string;
					id?: string;
					label: string;
					org_id: string;
					project_id: string;
				};
				Update: {
					created_at?: string;
					holiday_date?: string;
					id?: string;
					label?: string;
					org_id?: string;
					project_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "project_holidays_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "project_holidays_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
				];
			};
			project_notice_periods: {
				Row: {
					contract_kind: Database["public"]["Enums"]["contract_kind"];
					contract_section: string | null;
					counterparty_name: string | null;
					day_basis: Database["public"]["Enums"]["day_basis"];
					days: number;
					entered_at: string;
					entered_by: string | null;
					id: string;
					notice_type: Database["public"]["Enums"]["notice_type"];
					org_id: string;
					project_id: string;
				};
				ComputedFields: never;
				Insert: {
					contract_kind: Database["public"]["Enums"]["contract_kind"];
					contract_section?: string | null;
					counterparty_name?: string | null;
					day_basis: Database["public"]["Enums"]["day_basis"];
					days: number;
					entered_at?: string;
					entered_by?: string | null;
					id?: string;
					notice_type: Database["public"]["Enums"]["notice_type"];
					org_id: string;
					project_id: string;
				};
				Update: {
					contract_kind?: Database["public"]["Enums"]["contract_kind"];
					contract_section?: string | null;
					counterparty_name?: string | null;
					day_basis?: Database["public"]["Enums"]["day_basis"];
					days?: number;
					entered_at?: string;
					entered_by?: string | null;
					id?: string;
					notice_type?: Database["public"]["Enums"]["notice_type"];
					org_id?: string;
					project_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "project_notice_periods_entered_by_fkey";
						columns: ["entered_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "project_notice_periods_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "project_notice_periods_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
				];
			};
			project_parties: {
				Row: {
					company_name: string;
					created_at: string;
					email_domain: string;
					id: string;
					org_id: string;
					project_id: string;
					role: Database["public"]["Enums"]["company_role"];
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					company_name: string;
					created_at?: string;
					email_domain: string;
					id?: string;
					org_id: string;
					project_id: string;
					role: Database["public"]["Enums"]["company_role"];
					updated_at?: string;
				};
				Update: {
					company_name?: string;
					created_at?: string;
					email_domain?: string;
					id?: string;
					org_id?: string;
					project_id?: string;
					role?: Database["public"]["Enums"]["company_role"];
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "project_parties_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "project_parties_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
				];
			};
			project_sources: {
				Row: {
					connection_id: string;
					created_at: string;
					id: string;
					mailbox: string | null;
					org_id: string;
					project_id: string;
					settings: NonNullable<Json>;
					site_id: string | null;
					source_company_id: string | null;
					source_project_id: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					connection_id: string;
					created_at?: string;
					id?: string;
					mailbox?: string | null;
					org_id: string;
					project_id: string;
					settings?: NonNullable<Json>;
					site_id?: string | null;
					source_company_id?: string | null;
					source_project_id: string;
					updated_at?: string;
				};
				Update: {
					connection_id?: string;
					created_at?: string;
					id?: string;
					mailbox?: string | null;
					org_id?: string;
					project_id?: string;
					settings?: NonNullable<Json>;
					site_id?: string | null;
					source_company_id?: string | null;
					source_project_id?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "project_sources_connection_fk";
						columns: ["connection_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "integration_connections";
						referencedColumns: ["id", "org_id"];
					},
					{
						foreignKeyName: "project_sources_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "project_sources_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
				];
			};
			projects: {
				Row: {
					created_at: string;
					created_by: string | null;
					daily_delay_cost_usd: number | null;
					id: string;
					name: string;
					number: string | null;
					org_id: string;
					settings: NonNullable<Json>;
					timezone: string;
				};
				ComputedFields: never;
				Insert: {
					created_at?: string;
					created_by?: string | null;
					daily_delay_cost_usd?: number | null;
					id?: string;
					name: string;
					number?: string | null;
					org_id: string;
					settings?: NonNullable<Json>;
					timezone?: string;
				};
				Update: {
					created_at?: string;
					created_by?: string | null;
					daily_delay_cost_usd?: number | null;
					id?: string;
					name?: string;
					number?: string | null;
					org_id?: string;
					settings?: NonNullable<Json>;
					timezone?: string;
				};
				Relationships: [
					{
						foreignKeyName: "projects_created_by_fkey";
						columns: ["created_by"];
						isOneToOne: false;
						referencedRelation: "profiles";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "projects_org_id_fkey";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
				];
			};
			raw_records: {
				Row: {
					allowlisted_payload: NonNullable<Json>;
					deleted_at: string | null;
					entity_type: string;
					external_id: string;
					fingerprint: string;
					first_seen_at: string;
					id: string;
					last_seen_at: string;
					org_id: string;
					project_id: string;
					source: string;
				};
				ComputedFields: never;
				Insert: {
					allowlisted_payload: NonNullable<Json>;
					deleted_at?: string | null;
					entity_type: string;
					external_id: string;
					fingerprint: string;
					first_seen_at?: string;
					id?: string;
					last_seen_at?: string;
					org_id: string;
					project_id: string;
					source: string;
				};
				Update: {
					allowlisted_payload?: NonNullable<Json>;
					deleted_at?: string | null;
					entity_type?: string;
					external_id?: string;
					fingerprint?: string;
					first_seen_at?: string;
					id?: string;
					last_seen_at?: string;
					org_id?: string;
					project_id?: string;
					source?: string;
				};
				Relationships: [
					{
						foreignKeyName: "raw_records_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "raw_records_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
				];
			};
			rfis: {
				Row: {
					answer: string | null;
					assignees: Json | null;
					closed_date: string | null;
					cost_code: string | null;
					cost_impact_amount: number | null;
					cost_impact_status: string | null;
					created_at: string;
					due_date: string | null;
					external_id: string;
					id: string;
					initiated_date: string | null;
					location: string | null;
					number: string;
					org_id: string;
					project_id: string;
					question: string | null;
					raw_record_id: string;
					responsible_contractor: Json | null;
					schedule_impact_days: number | null;
					schedule_impact_status: string | null;
					status: string;
					subject: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					answer?: string | null;
					assignees?: Json | null;
					closed_date?: string | null;
					cost_code?: string | null;
					cost_impact_amount?: number | null;
					cost_impact_status?: string | null;
					created_at?: string;
					due_date?: string | null;
					external_id: string;
					id?: string;
					initiated_date?: string | null;
					location?: string | null;
					number: string;
					org_id: string;
					project_id: string;
					question?: string | null;
					raw_record_id: string;
					responsible_contractor?: Json | null;
					schedule_impact_days?: number | null;
					schedule_impact_status?: string | null;
					status: string;
					subject: string;
					updated_at?: string;
				};
				Update: {
					answer?: string | null;
					assignees?: Json | null;
					closed_date?: string | null;
					cost_code?: string | null;
					cost_impact_amount?: number | null;
					cost_impact_status?: string | null;
					created_at?: string;
					due_date?: string | null;
					external_id?: string;
					id?: string;
					initiated_date?: string | null;
					location?: string | null;
					number?: string;
					org_id?: string;
					project_id?: string;
					question?: string | null;
					raw_record_id?: string;
					responsible_contractor?: Json | null;
					schedule_impact_days?: number | null;
					schedule_impact_status?: string | null;
					status?: string;
					subject?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "rfis_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "rfis_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
					{
						foreignKeyName: "rfis_raw_record_fk";
						columns: ["raw_record_id", "org_id", "project_id"];
						isOneToOne: false;
						referencedRelation: "raw_records";
						referencedColumns: ["id", "org_id", "project_id"];
					},
				];
			};
			schedule_activities: {
				Row: {
					baseline_finish: string | null;
					baseline_start: string | null;
					created_at: string;
					early_finish: string | null;
					early_start: string | null;
					external_id: string;
					free_float_days: number | null;
					id: string;
					import_id: string | null;
					late_finish: string | null;
					late_start: string | null;
					name: string;
					org_id: string;
					predecessors: string[];
					project_id: string;
					raw_record_id: string | null;
					status: string | null;
					task_code: string;
					task_id: string | null;
					total_float_days: number | null;
					updated_at: string;
					wbs_path: string | null;
				};
				ComputedFields: never;
				Insert: {
					baseline_finish?: string | null;
					baseline_start?: string | null;
					created_at?: string;
					early_finish?: string | null;
					early_start?: string | null;
					external_id: string;
					free_float_days?: number | null;
					id?: string;
					import_id?: string | null;
					late_finish?: string | null;
					late_start?: string | null;
					name: string;
					org_id: string;
					predecessors?: string[];
					project_id: string;
					raw_record_id?: string | null;
					status?: string | null;
					task_code: string;
					task_id?: string | null;
					total_float_days?: number | null;
					updated_at?: string;
					wbs_path?: string | null;
				};
				Update: {
					baseline_finish?: string | null;
					baseline_start?: string | null;
					created_at?: string;
					early_finish?: string | null;
					early_start?: string | null;
					external_id?: string;
					free_float_days?: number | null;
					id?: string;
					import_id?: string | null;
					late_finish?: string | null;
					late_start?: string | null;
					name?: string;
					org_id?: string;
					predecessors?: string[];
					project_id?: string;
					raw_record_id?: string | null;
					status?: string | null;
					task_code?: string;
					task_id?: string | null;
					total_float_days?: number | null;
					updated_at?: string;
					wbs_path?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "schedule_activities_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "schedule_activities_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
					{
						foreignKeyName: "schedule_activities_raw_record_fk";
						columns: ["raw_record_id", "org_id", "project_id"];
						isOneToOne: false;
						referencedRelation: "raw_records";
						referencedColumns: ["id", "org_id", "project_id"];
					},
				];
			};
			submittals: {
				Row: {
					approver_responses: Json | null;
					buffer_time_days: number | null;
					created_at: string;
					current_revision: number | null;
					due_date: string | null;
					external_id: string;
					id: string;
					lead_time_days: number | null;
					number: string;
					org_id: string;
					project_id: string;
					raw_record_id: string;
					received_date: string | null;
					required_on_site_date: string | null;
					review_time_days: number | null;
					schedule_activity_id: string | null;
					schedule_match_confidence: number | null;
					schedule_match_method:
						| Database["public"]["Enums"]["schedule_match_method"]
						| null;
					scheduled_task: Json | null;
					spec_section: string | null;
					status: string;
					title: string;
					updated_at: string;
				};
				ComputedFields: never;
				Insert: {
					approver_responses?: Json | null;
					buffer_time_days?: number | null;
					created_at?: string;
					current_revision?: number | null;
					due_date?: string | null;
					external_id: string;
					id?: string;
					lead_time_days?: number | null;
					number: string;
					org_id: string;
					project_id: string;
					raw_record_id: string;
					received_date?: string | null;
					required_on_site_date?: string | null;
					review_time_days?: number | null;
					schedule_activity_id?: string | null;
					schedule_match_confidence?: number | null;
					schedule_match_method?:
						| Database["public"]["Enums"]["schedule_match_method"]
						| null;
					scheduled_task?: Json | null;
					spec_section?: string | null;
					status: string;
					title: string;
					updated_at?: string;
				};
				Update: {
					approver_responses?: Json | null;
					buffer_time_days?: number | null;
					created_at?: string;
					current_revision?: number | null;
					due_date?: string | null;
					external_id?: string;
					id?: string;
					lead_time_days?: number | null;
					number?: string;
					org_id?: string;
					project_id?: string;
					raw_record_id?: string;
					received_date?: string | null;
					required_on_site_date?: string | null;
					review_time_days?: number | null;
					schedule_activity_id?: string | null;
					schedule_match_confidence?: number | null;
					schedule_match_method?:
						| Database["public"]["Enums"]["schedule_match_method"]
						| null;
					scheduled_task?: Json | null;
					spec_section?: string | null;
					status?: string;
					title?: string;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "submittals_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "submittals_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
					{
						foreignKeyName: "submittals_raw_record_fk";
						columns: ["raw_record_id", "org_id", "project_id"];
						isOneToOne: false;
						referencedRelation: "raw_records";
						referencedColumns: ["id", "org_id", "project_id"];
					},
					{
						foreignKeyName: "submittals_schedule_activity_fk";
						columns: ["schedule_activity_id", "org_id", "project_id"];
						isOneToOne: false;
						referencedRelation: "schedule_activities";
						referencedColumns: ["id", "org_id", "project_id"];
					},
				];
			};
			sync_runs: {
				Row: {
					checkpoint: Json | null;
					counts: Json | null;
					created_at: string;
					error_code: string | null;
					error_summary: string | null;
					finished_at: string | null;
					id: string;
					kind: Database["public"]["Enums"]["sync_kind"];
					org_id: string;
					project_id: string;
					project_source_id: string;
					started_at: string | null;
					status: Database["public"]["Enums"]["sync_status"];
				};
				ComputedFields: never;
				Insert: {
					checkpoint?: Json | null;
					counts?: Json | null;
					created_at?: string;
					error_code?: string | null;
					error_summary?: string | null;
					finished_at?: string | null;
					id?: string;
					kind: Database["public"]["Enums"]["sync_kind"];
					org_id: string;
					project_id: string;
					project_source_id: string;
					started_at?: string | null;
					status?: Database["public"]["Enums"]["sync_status"];
				};
				Update: {
					checkpoint?: Json | null;
					counts?: Json | null;
					created_at?: string;
					error_code?: string | null;
					error_summary?: string | null;
					finished_at?: string | null;
					id?: string;
					kind?: Database["public"]["Enums"]["sync_kind"];
					org_id?: string;
					project_id?: string;
					project_source_id?: string;
					started_at?: string | null;
					status?: Database["public"]["Enums"]["sync_status"];
				};
				Relationships: [
					{
						foreignKeyName: "sync_runs_org_fk";
						columns: ["org_id"];
						isOneToOne: false;
						referencedRelation: "orgs";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "sync_runs_org_project_fk";
						columns: ["project_id", "org_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id", "org_id"];
					},
					{
						foreignKeyName: "sync_runs_project_source_fk";
						columns: ["project_source_id", "org_id", "project_id"];
						isOneToOne: false;
						referencedRelation: "project_sources";
						referencedColumns: ["id", "org_id", "project_id"];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			create_org: { Args: { p_name: string; p_slug: string }; Returns: string };
			dearmor: { Args: { "": string }; Returns: string };
			gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string };
			gen_salt: { Args: { "": string }; Returns: string };
			has_org_role: {
				Args: { p_org_id: string; p_roles: string[] };
				Returns: boolean;
			};
			is_org_member: { Args: { p_org_id: string }; Returns: boolean };
			pgp_armor_headers: {
				Args: { "": string };
				Returns: Record<string, unknown>[];
			};
		};
		Enums: {
			company_role: "owner" | "architect_engineer" | "gc" | "sub";
			connection_status: "pending" | "active" | "error" | "disconnected";
			contract_kind: "owner_gc" | "gc_sub";
			day_basis: "calendar" | "business";
			integration_provider: "procore" | "msgraph" | "p6_upload";
			notice_type:
				| "delay_time_extension"
				| "cost_change_claim"
				| "differing_site_condition"
				| "change_directive_dispute"
				| "cure_default"
				| "injury_property_damage"
				| "other";
			received_at_source: "graph" | "forwarded_text";
			schedule_match_method: "task_code" | "name_spec" | "manual";
			sync_kind: "backfill" | "incremental" | "reconcile" | "purge";
			sync_status: "queued" | "running" | "succeeded" | "failed" | "partial";
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
	keyof Database,
	"public"
>];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
				DefaultSchema["Views"])
		? (DefaultSchema["Tables"] &
				DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {
			company_role: ["owner", "architect_engineer", "gc", "sub"],
			connection_status: ["pending", "active", "error", "disconnected"],
			contract_kind: ["owner_gc", "gc_sub"],
			day_basis: ["calendar", "business"],
			integration_provider: ["procore", "msgraph", "p6_upload"],
			notice_type: [
				"delay_time_extension",
				"cost_change_claim",
				"differing_site_condition",
				"change_directive_dispute",
				"cure_default",
				"injury_property_damage",
				"other",
			],
			received_at_source: ["graph", "forwarded_text"],
			schedule_match_method: ["task_code", "name_spec", "manual"],
			sync_kind: ["backfill", "incremental", "reconcile", "purge"],
			sync_status: ["queued", "running", "succeeded", "failed", "partial"],
		},
	},
} as const;
