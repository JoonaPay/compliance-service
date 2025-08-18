import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateKycVerificationsTable1755218400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create extension for UUID generation
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    
    await queryRunner.createTable(
      new Table({
        name: "kyc_verifications",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "user_id",
            type: "uuid",
          },
          {
            name: "verification_reference",
            type: "varchar",
            length: "100",
            isUnique: true,
          },
          {
            name: "verification_type",
            type: "enum",
            enum: ["IDENTITY_VERIFICATION", "DOCUMENT_VERIFICATION", "ADDRESS_VERIFICATION", "ENHANCED_DUE_DILIGENCE"],
          },
          {
            name: "document_type",
            type: "enum",
            enum: ["PASSPORT", "DRIVERS_LICENSE", "NATIONAL_ID", "UTILITY_BILL", "BANK_STATEMENT", "OTHER"],
            isNullable: true,
          },
          {
            name: "status",
            type: "enum",
            enum: ["PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "EXPIRED", "REQUIRES_MANUAL_REVIEW"],
            default: "'PENDING'",
          },
          {
            name: "provider",
            type: "enum",
            enum: ["JUMIO", "ONFIDO", "MANUAL"],
            default: "'MANUAL'",
          },
          {
            name: "provider_verification_id",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "personal_info",
            type: "jsonb",
            comment: "First name, last name, date of birth, nationality, address",
          },
          {
            name: "document_data",
            type: "jsonb",
            isNullable: true,
            comment: "Document images, extracted data, OCR results",
          },
          {
            name: "verification_results",
            type: "jsonb",
            isNullable: true,
            comment: "Provider results, scores, confidence levels",
          },
          {
            name: "risk_score",
            type: "decimal",
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: "risk_factors",
            type: "jsonb",
            isNullable: true,
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
            name: "expires_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "submitted_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "completed_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "callback_url",
            type: "varchar",
            length: "500",
            isNullable: true,
          },
          {
            name: "webhook_data",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "attempt_count",
            type: "integer",
            default: 1,
          },
          {
            name: "max_attempts",
            type: "integer",
            default: 3,
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
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_kyc_verifications_updated_at 
      BEFORE UPDATE ON kyc_verifications 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function to generate verification references
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_verification_reference()
      RETURNS TEXT AS $$
      DECLARE
        new_reference TEXT;
        exists_check INTEGER;
      BEGIN
        LOOP
          // Generate verification reference: KYC + YYYYMMDD + 8 random digits
          new_reference := 'KYC' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
          
          SELECT COUNT(*) INTO exists_check 
          FROM kyc_verifications 
          WHERE verification_reference = new_reference;
          
          IF exists_check = 0 THEN
            EXIT;
          END IF;
        END LOOP;
        
        RETURN new_reference;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to auto-generate verification references
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_verification_reference()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.verification_reference IS NULL OR NEW.verification_reference = '' THEN
          NEW.verification_reference := generate_verification_reference();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_verification_reference_trigger
      BEFORE INSERT ON kyc_verifications
      FOR EACH ROW
      EXECUTE FUNCTION set_verification_reference();
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_USER_ID ON kyc_verifications (user_id)`);
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_REFERENCE ON kyc_verifications (verification_reference)`);
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_TYPE ON kyc_verifications (verification_type)`);
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_STATUS ON kyc_verifications (status)`);
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_PROVIDER ON kyc_verifications (provider)`);
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_PROVIDER_ID ON kyc_verifications (provider_verification_id)`);
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_EXPIRES_AT ON kyc_verifications (expires_at)`);
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_CREATED_AT ON kyc_verifications (created_at)`);
    await queryRunner.query(`CREATE INDEX IDX_KYC_VERIFICATIONS_COMPLETED_AT ON kyc_verifications (completed_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_verification_reference_trigger ON kyc_verifications`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_kyc_verifications_updated_at ON kyc_verifications`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_verification_reference`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_verification_reference`);
    await queryRunner.dropTable("kyc_verifications");
  }
}