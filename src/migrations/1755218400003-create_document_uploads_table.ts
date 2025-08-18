import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateDocumentUploadsTable1755218400003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "document_uploads",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "verification_id",
            type: "uuid",
            comment: "Associated KYC or KYB verification ID",
          },
          {
            name: "verification_type",
            type: "enum",
            enum: ["KYC", "KYB"],
            comment: "Type of verification this document belongs to",
          },
          {
            name: "document_reference",
            type: "varchar",
            length: "100",
            isUnique: true,
          },
          {
            name: "document_type",
            type: "enum",
            enum: [
              "PASSPORT",
              "DRIVERS_LICENSE", 
              "NATIONAL_ID",
              "UTILITY_BILL",
              "BANK_STATEMENT",
              "BIRTH_CERTIFICATE",
              "MARRIAGE_CERTIFICATE",
              "BUSINESS_REGISTRATION",
              "ARTICLES_OF_INCORPORATION",
              "MEMORANDUM_OF_ASSOCIATION",
              "CERTIFICATE_OF_GOOD_STANDING",
              "TAX_CERTIFICATE",
              "BANK_LETTER",
              "AUDITED_FINANCIALS",
              "BENEFICIAL_OWNERSHIP_DECLARATION",
              "OTHER"
            ],
          },
          {
            name: "document_category",
            type: "enum",
            enum: ["IDENTITY", "ADDRESS", "BUSINESS", "FINANCIAL", "LEGAL", "OTHER"],
          },
          {
            name: "file_name",
            type: "varchar",
            length: "255",
          },
          {
            name: "original_file_name",
            type: "varchar",
            length: "255",
          },
          {
            name: "file_size",
            type: "bigint",
            comment: "File size in bytes",
          },
          {
            name: "mime_type",
            type: "varchar",
            length: "100",
          },
          {
            name: "file_extension",
            type: "varchar",
            length: "10",
          },
          {
            name: "file_path",
            type: "varchar",
            length: "500",
            comment: "Secure storage path",
          },
          {
            name: "file_hash",
            type: "varchar",
            length: "64",
            comment: "SHA-256 hash for integrity verification",
          },
          {
            name: "encryption_key_id",
            type: "varchar",
            length: "100",
            isNullable: true,
            comment: "Reference to encryption key for encrypted files",
          },
          {
            name: "upload_status",
            type: "enum",
            enum: ["UPLOADING", "UPLOADED", "PROCESSING", "PROCESSED", "FAILED", "DELETED"],
            default: "'UPLOADING'",
          },
          {
            name: "verification_status",
            type: "enum",
            enum: ["PENDING", "VERIFIED", "REJECTED", "MANUAL_REVIEW_REQUIRED"],
            default: "'PENDING'",
          },
          {
            name: "quality_score",
            type: "decimal",
            precision: 5,
            scale: 2,
            isNullable: true,
            comment: "Document quality assessment score (0-100)",
          },
          {
            name: "quality_checks",
            type: "jsonb",
            isNullable: true,
            comment: "Quality assessment results (blur, resolution, etc.)",
          },
          {
            name: "ocr_data",
            type: "jsonb",
            isNullable: true,
            comment: "Extracted text and data from OCR processing",
          },
          {
            name: "extracted_fields",
            type: "jsonb",
            isNullable: true,
            comment: "Structured data extracted from document",
          },
          {
            name: "provider_analysis",
            type: "jsonb",
            isNullable: true,
            comment: "External provider analysis results",
          },
          {
            name: "fraud_indicators",
            type: "jsonb",
            isNullable: true,
            comment: "Fraud detection results and scores",
          },
          {
            name: "compliance_checks",
            type: "jsonb",
            isNullable: true,
            comment: "Compliance validation results",
          },
          {
            name: "expiry_date",
            type: "date",
            isNullable: true,
            comment: "Document expiry date if applicable",
          },
          {
            name: "issue_date",
            type: "date",
            isNullable: true,
            comment: "Document issue date if applicable",
          },
          {
            name: "issuing_authority",
            type: "varchar",
            length: "255",
            isNullable: true,
            comment: "Authority that issued the document",
          },
          {
            name: "issuing_country",
            type: "varchar",
            length: "2",
            isNullable: true,
            comment: "ISO 3166-1 alpha-2 country code",
          },
          {
            name: "document_number",
            type: "varchar",
            length: "100",
            isNullable: true,
            comment: "Document number extracted from document",
          },
          {
            name: "rejection_reasons",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "manual_review_notes",
            type: "text",
            isNullable: true,
          },
          {
            name: "reviewed_by",
            type: "uuid",
            isNullable: true,
            comment: "User ID of reviewer",
          },
          {
            name: "reviewed_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "uploaded_by",
            type: "uuid",
            comment: "User ID who uploaded the document",
          },
          {
            name: "uploaded_via",
            type: "enum",
            enum: ["API", "WEB_PORTAL", "MOBILE_APP", "EMAIL"],
            default: "'API'",
          },
          {
            name: "ip_address",
            type: "inet",
            isNullable: true,
            comment: "IP address from which document was uploaded",
          },
          {
            name: "user_agent",
            type: "text",
            isNullable: true,
            comment: "User agent string for audit purposes",
          },
          {
            name: "retention_period",
            type: "integer",
            default: 2555,
            comment: "Retention period in days",
          },
          {
            name: "auto_delete_at",
            type: "timestamp",
            isNullable: true,
            comment: "Automatic deletion date based on retention policy",
          },
          {
            name: "deleted_at",
            type: "timestamp",
            isNullable: true,
            comment: "Soft delete timestamp",
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
      }),
      true,
    );

    // Create trigger for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_document_uploads_updated_at 
      BEFORE UPDATE ON document_uploads 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function to generate document references
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_document_reference()
      RETURNS TEXT AS $$
      DECLARE
        new_reference TEXT;
        exists_check INTEGER;
      BEGIN
        LOOP
          // Generate document reference: DOC + YYYYMMDD + 8 random digits
          new_reference := 'DOC' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
          
          SELECT COUNT(*) INTO exists_check 
          FROM document_uploads 
          WHERE document_reference = new_reference;
          
          IF exists_check = 0 THEN
            EXIT;
          END IF;
        END LOOP;
        
        RETURN new_reference;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to auto-generate document references and set auto-delete date
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_document_reference_and_retention()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.document_reference IS NULL OR NEW.document_reference = '' THEN
          NEW.document_reference := generate_document_reference();
        END IF;
        
        IF NEW.auto_delete_at IS NULL AND NEW.retention_period IS NOT NULL THEN
          NEW.auto_delete_at := NEW.created_at + (NEW.retention_period || ' days')::INTERVAL;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_document_reference_and_retention_trigger
      BEFORE INSERT ON document_uploads
      FOR EACH ROW
      EXECUTE FUNCTION set_document_reference_and_retention();
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_VERIFICATION_ID ON document_uploads (verification_id)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_VERIFICATION_TYPE ON document_uploads (verification_type)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_REFERENCE ON document_uploads (document_reference)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_TYPE ON document_uploads (document_type)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_CATEGORY ON document_uploads (document_category)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_STATUS ON document_uploads (upload_status)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_VERIFICATION_STATUS ON document_uploads (verification_status)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_FILE_HASH ON document_uploads (file_hash)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_UPLOADED_BY ON document_uploads (uploaded_by)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_EXPIRY_DATE ON document_uploads (expiry_date)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_AUTO_DELETE_AT ON document_uploads (auto_delete_at)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_DELETED_AT ON document_uploads (deleted_at)`);
    await queryRunner.query(`CREATE INDEX IDX_DOCUMENT_UPLOADS_CREATED_AT ON document_uploads (created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_document_reference_and_retention_trigger ON document_uploads`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_document_uploads_updated_at ON document_uploads`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_document_reference_and_retention`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_document_reference`);
    await queryRunner.dropTable("document_uploads");
  }
}