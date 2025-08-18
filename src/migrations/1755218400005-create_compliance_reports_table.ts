import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateComplianceReportsTable1755218400005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "compliance_reports",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "report_reference",
            type: "varchar",
            length: "100",
            isUnique: true,
          },
          {
            name: "report_type",
            type: "enum",
            enum: [
              "DAILY_TRANSACTION_REPORT",
              "WEEKLY_KYC_REPORT", 
              "MONTHLY_COMPLIANCE_SUMMARY",
              "QUARTERLY_RISK_ASSESSMENT",
              "ANNUAL_COMPLIANCE_REVIEW",
              "SAR_REPORT",
              "CTR_REPORT",
              "SANCTIONS_VIOLATIONS",
              "KYC_COMPLETION_RATES",
              "SUSPICIOUS_ACTIVITY_SUMMARY",
              "CUSTOMER_RISK_PROFILE_REPORT",
              "DOCUMENT_VERIFICATION_REPORT",
              "MANUAL_REVIEW_BACKLOG",
              "REGULATORY_FILING",
              "AUDIT_TRAIL_EXPORT",
              "CUSTOM_REPORT"
            ],
          },
          {
            name: "report_category",
            type: "enum",
            enum: ["REGULATORY", "INTERNAL", "AUDIT", "OPERATIONAL", "RISK_MANAGEMENT"],
          },
          {
            name: "report_title",
            type: "varchar",
            length: "255",
          },
          {
            name: "report_description",
            type: "text",
            isNullable: true,
          },
          {
            name: "reporting_period_start",
            type: "date",
            comment: "Start date of the reporting period",
          },
          {
            name: "reporting_period_end",
            type: "date",
            comment: "End date of the reporting period",
          },
          {
            name: "status",
            type: "enum",
            enum: ["GENERATING", "COMPLETED", "FAILED", "SCHEDULED", "CANCELLED"],
            default: "'GENERATING'",
          },
          {
            name: "generation_started_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "generation_completed_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "generation_duration_ms",
            type: "integer",
            isNullable: true,
            comment: "Time taken to generate report in milliseconds",
          },
          {
            name: "generated_by",
            type: "uuid",
            comment: "User ID who generated the report",
          },
          {
            name: "generation_method",
            type: "enum",
            enum: ["MANUAL", "SCHEDULED", "API", "AUTOMATED"],
            default: "'MANUAL'",
          },
          {
            name: "report_format",
            type: "enum",
            enum: ["PDF", "EXCEL", "CSV", "JSON", "XML"],
            default: "'PDF'",
          },
          {
            name: "file_path",
            type: "varchar",
            length: "500",
            isNullable: true,
            comment: "Path to generated report file",
          },
          {
            name: "file_size",
            type: "bigint",
            isNullable: true,
            comment: "File size in bytes",
          },
          {
            name: "file_hash",
            type: "varchar",
            length: "64",
            isNullable: true,
            comment: "SHA-256 hash for integrity verification",
          },
          {
            name: "encryption_key_id",
            type: "varchar",
            length: "100",
            isNullable: true,
            comment: "Reference to encryption key for encrypted reports",
          },
          {
            name: "report_data",
            type: "jsonb",
            isNullable: true,
            comment: "Structured report data and metrics",
          },
          {
            name: "report_summary",
            type: "jsonb",
            isNullable: true,
            comment: "Executive summary and key metrics",
          },
          {
            name: "filters_applied",
            type: "jsonb",
            isNullable: true,
            comment: "Filters and parameters used to generate the report",
          },
          {
            name: "data_sources",
            type: "jsonb",
            isNullable: true,
            comment: "List of data sources used in the report",
          },
          {
            name: "record_count",
            type: "integer",
            isNullable: true,
            comment: "Number of records included in the report",
          },
          {
            name: "total_amount",
            type: "decimal",
            precision: 15,
            scale: 2,
            isNullable: true,
            comment: "Total monetary amount if applicable",
          },
          {
            name: "currency_code",
            type: "varchar",
            length: "3",
            isNullable: true,
            comment: "ISO 4217 currency code",
          },
          {
            name: "regulatory_requirement",
            type: "varchar",
            length: "100",
            isNullable: true,
            comment: "Associated regulatory requirement (e.g., BSA, AML, KYC)",
          },
          {
            name: "jurisdiction",
            type: "varchar",
            length: "2",
            isNullable: true,
            comment: "ISO 3166-1 alpha-2 country code for jurisdiction",
          },
          {
            name: "confidentiality_level",
            type: "enum",
            enum: ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED", "TOP_SECRET"],
            default: "'CONFIDENTIAL'",
          },
          {
            name: "access_permissions",
            type: "jsonb",
            isNullable: true,
            comment: "User roles and permissions for accessing this report",
          },
          {
            name: "distribution_list",
            type: "jsonb",
            isNullable: true,
            comment: "List of recipients who should receive this report",
          },
          {
            name: "external_submission_required",
            type: "boolean",
            default: false,
            comment: "Whether this report needs to be submitted to external authorities",
          },
          {
            name: "submission_deadline",
            type: "date",
            isNullable: true,
          },
          {
            name: "submitted_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "submitted_by",
            type: "uuid",
            isNullable: true,
          },
          {
            name: "submission_confirmation",
            type: "varchar",
            length: "255",
            isNullable: true,
            comment: "Confirmation number or reference from external authority",
          },
          {
            name: "retention_period",
            type: "integer",
            default: 2555,
            comment: "Retention period in days (default 7 years)",
          },
          {
            name: "auto_delete_at",
            type: "timestamp",
            isNullable: true,
            comment: "Automatic deletion date based on retention policy",
          },
          {
            name: "archived_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "archive_location",
            type: "varchar",
            length: "500",
            isNullable: true,
          },
          {
            name: "error_message",
            type: "text",
            isNullable: true,
            comment: "Error message if report generation failed",
          },
          {
            name: "error_details",
            type: "jsonb",
            isNullable: true,
            comment: "Detailed error information for debugging",
          },
          {
            name: "schedule_config",
            type: "jsonb",
            isNullable: true,
            comment: "Configuration for scheduled report generation",
          },
          {
            name: "next_scheduled_run",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "is_template",
            type: "boolean",
            default: false,
            comment: "Whether this is a template for recurring reports",
          },
          {
            name: "template_id",
            type: "uuid",
            isNullable: true,
            comment: "Reference to template if this report was generated from one",
          },
          {
            name: "version",
            type: "integer",
            default: 1,
            comment: "Report version for tracking changes",
          },
          {
            name: "previous_version_id",
            type: "uuid",
            isNullable: true,
            comment: "Reference to previous version of this report",
          },
          {
            name: "tags",
            type: "jsonb",
            isNullable: true,
            comment: "Tags for categorization and search",
          },
          {
            name: "metadata",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
        // Indexes will be created via queryRunner.query() after table creation
        foreignKeys: [
          {
            name: "FK_COMPLIANCE_REPORTS_TEMPLATE",
            columnNames: ["template_id"],
            referencedTableName: "compliance_reports",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
          },
          {
            name: "FK_COMPLIANCE_REPORTS_PREVIOUS_VERSION",
            columnNames: ["previous_version_id"],
            referencedTableName: "compliance_reports",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
          },
        ],
      }),
      true,
    );

    // Create trigger for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_compliance_reports_updated_at 
      BEFORE UPDATE ON compliance_reports 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function to generate report references
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_report_reference()
      RETURNS TEXT AS $$
      DECLARE
        new_reference TEXT;
        exists_check INTEGER;
      BEGIN
        LOOP
          // Generate report reference: RPT + YYYYMMDD + 8 random digits
          new_reference := 'RPT' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
          
          SELECT COUNT(*) INTO exists_check 
          FROM compliance_reports 
          WHERE report_reference = new_reference;
          
          IF exists_check = 0 THEN
            EXIT;
          END IF;
        END LOOP;
        
        RETURN new_reference;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to auto-generate report references and set auto-delete date
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_report_reference_and_retention()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.report_reference IS NULL OR NEW.report_reference = '' THEN
          NEW.report_reference := generate_report_reference();
        END IF;
        
        IF NEW.auto_delete_at IS NULL AND NEW.retention_period IS NOT NULL THEN
          NEW.auto_delete_at := NEW.created_at + (NEW.retention_period || ' days')::INTERVAL;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_report_reference_and_retention_trigger
      BEFORE INSERT ON compliance_reports
      FOR EACH ROW
      EXECUTE FUNCTION set_report_reference_and_retention();
    `);

    // Create view for active reports (not archived or deleted)
    await queryRunner.query(`
      CREATE VIEW active_compliance_reports AS
      SELECT * FROM compliance_reports 
      WHERE archived_at IS NULL 
      AND status != 'CANCELLED'
      AND (auto_delete_at IS NULL OR auto_delete_at > CURRENT_TIMESTAMP);
    `);

    // Create view for overdue submissions
    await queryRunner.query(`
      CREATE VIEW overdue_compliance_submissions AS
      SELECT * FROM compliance_reports 
      WHERE external_submission_required = true
      AND submitted_at IS NULL
      AND submission_deadline < CURRENT_DATE
      AND status = 'COMPLETED';
    `);

    // Create view for scheduled reports
    await queryRunner.query(`
      CREATE VIEW scheduled_compliance_reports AS
      SELECT * FROM compliance_reports 
      WHERE status = 'SCHEDULED'
      AND next_scheduled_run <= CURRENT_TIMESTAMP;
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_REFERENCE ON compliance_reports (report_reference)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_TYPE ON compliance_reports (report_type)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_CATEGORY ON compliance_reports (report_category)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_STATUS ON compliance_reports (status)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_PERIOD ON compliance_reports (reporting_period_start, reporting_period_end)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_GENERATED_BY ON compliance_reports (generated_by)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_GENERATION_METHOD ON compliance_reports (generation_method)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_REGULATORY_REQ ON compliance_reports (regulatory_requirement)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_JURISDICTION ON compliance_reports (jurisdiction)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_CONFIDENTIALITY ON compliance_reports (confidentiality_level)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_SUBMISSION_REQUIRED ON compliance_reports (external_submission_required)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_SUBMISSION_DEADLINE ON compliance_reports (submission_deadline)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_AUTO_DELETE ON compliance_reports (auto_delete_at)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_NEXT_SCHEDULED ON compliance_reports (next_scheduled_run)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_IS_TEMPLATE ON compliance_reports (is_template)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_TEMPLATE_ID ON compliance_reports (template_id)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_VERSION ON compliance_reports (version)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_CREATED_AT ON compliance_reports (created_at)`);
    await queryRunner.query(`CREATE INDEX IDX_COMPLIANCE_REPORTS_COMPLETED_AT ON compliance_reports (generation_completed_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS scheduled_compliance_reports`);
    await queryRunner.query(`DROP VIEW IF EXISTS overdue_compliance_submissions`);
    await queryRunner.query(`DROP VIEW IF EXISTS active_compliance_reports`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_report_reference_and_retention_trigger ON compliance_reports`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_compliance_reports_updated_at ON compliance_reports`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_report_reference_and_retention`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_report_reference`);
    await queryRunner.dropTable("compliance_reports");
  }
}