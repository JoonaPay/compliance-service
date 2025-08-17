import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateKybVerificationsTable1755218400002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "kyb_verifications",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "business_id",
            type: "uuid",
            comment: "Business account ID being verified",
          },
          {
            name: "verification_reference",
            type: "varchar",
            length: "100",
            isUnique: true,
          },
          {
            name: "business_name",
            type: "varchar",
            length: "255",
          },
          {
            name: "business_type",
            type: "enum",
            enum: ["CORPORATION", "LLC", "PARTNERSHIP", "SOLE_PROPRIETORSHIP", "NON_PROFIT", "OTHER"],
          },
          {
            name: "registration_number",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "tax_id",
            type: "varchar",
            length: "50",
            isNullable: true,
          },
          {
            name: "incorporation_date",
            type: "date",
            isNullable: true,
          },
          {
            name: "incorporation_country",
            type: "varchar",
            length: "2",
            comment: "ISO 3166-1 alpha-2 country code",
          },
          {
            name: "incorporation_state",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "business_address",
            type: "jsonb",
            comment: "Registered business address",
          },
          {
            name: "operational_address",
            type: "jsonb",
            isNullable: true,
            comment: "Operational business address if different",
          },
          {
            name: "industry_code",
            type: "varchar",
            length: "10",
            isNullable: true,
            comment: "NAICS or SIC industry code",
          },
          {
            name: "business_description",
            type: "text",
            isNullable: true,
          },
          {
            name: "website_url",
            type: "varchar",
            length: "500",
            isNullable: true,
          },
          {
            name: "annual_revenue",
            type: "decimal",
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: "employee_count",
            type: "integer",
            isNullable: true,
          },
          {
            name: "status",
            type: "enum",
            enum: ["PENDING", "IN_PROGRESS", "APPROVED", "REJECTED", "EXPIRED", "REQUIRES_MANUAL_REVIEW"],
            default: "'PENDING'",
          },
          {
            name: "verification_stage",
            type: "enum",
            enum: ["DOCUMENTS_PENDING", "DOCUMENTS_UPLOADED", "BUSINESS_VERIFICATION", "UBO_VERIFICATION", "COMPLETED"],
            default: "'DOCUMENTS_PENDING'",
          },
          {
            name: "risk_level",
            type: "enum",
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            isNullable: true,
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
            name: "document_requirements",
            type: "jsonb",
            comment: "Required documents for verification",
          },
          {
            name: "submitted_documents",
            type: "jsonb",
            isNullable: true,
            comment: "List of submitted document IDs",
          },
          {
            name: "verification_results",
            type: "jsonb",
            isNullable: true,
            comment: "External provider verification results",
          },
          {
            name: "corporate_structure",
            type: "jsonb",
            isNullable: true,
            comment: "Ownership structure and hierarchy",
          },
          {
            name: "ubo_verified",
            type: "boolean",
            default: false,
            comment: "Ultimate Beneficial Ownership verified",
          },
          {
            name: "sanctions_screened",
            type: "boolean",
            default: false,
          },
          {
            name: "pep_screened",
            type: "boolean",
            default: false,
          },
          {
            name: "provider",
            type: "enum",
            enum: ["PASSFORT", "REFINITIV", "MANUAL"],
            default: "'MANUAL'",
          },
          {
            name: "provider_verification_id",
            type: "varchar",
            length: "255",
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
        indices: [
          new Index({
            name: "IDX_KYB_VERIFICATIONS_BUSINESS_ID",
            columnNames: ["business_id"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_REFERENCE",
            columnNames: ["verification_reference"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_STATUS",
            columnNames: ["status"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_STAGE",
            columnNames: ["verification_stage"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_RISK_LEVEL",
            columnNames: ["risk_level"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_BUSINESS_NAME",
            columnNames: ["business_name"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_REGISTRATION_NUMBER",
            columnNames: ["registration_number"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_TAX_ID",
            columnNames: ["tax_id"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_PROVIDER",
            columnNames: ["provider"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_PROVIDER_ID",
            columnNames: ["provider_verification_id"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_EXPIRES_AT",
            columnNames: ["expires_at"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_CREATED_AT",
            columnNames: ["created_at"],
          }),
          new Index({
            name: "IDX_KYB_VERIFICATIONS_COMPLETED_AT",
            columnNames: ["completed_at"],
          }),
        ],
      }),
      true,
    );

    // Create trigger for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_kyb_verifications_updated_at 
      BEFORE UPDATE ON kyb_verifications 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function to generate KYB verification references
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_kyb_verification_reference()
      RETURNS TEXT AS $$
      DECLARE
        new_reference TEXT;
        exists_check INTEGER;
      BEGIN
        LOOP
          -- Generate verification reference: KYB + YYYYMMDD + 8 random digits
          new_reference := 'KYB' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
          
          SELECT COUNT(*) INTO exists_check 
          FROM kyb_verifications 
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
      CREATE OR REPLACE FUNCTION set_kyb_verification_reference()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.verification_reference IS NULL OR NEW.verification_reference = '' THEN
          NEW.verification_reference := generate_kyb_verification_reference();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_kyb_verification_reference_trigger
      BEFORE INSERT ON kyb_verifications
      FOR EACH ROW
      EXECUTE FUNCTION set_kyb_verification_reference();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_kyb_verification_reference_trigger ON kyb_verifications`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_kyb_verifications_updated_at ON kyb_verifications`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_kyb_verification_reference`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_kyb_verification_reference`);
    await queryRunner.dropTable("kyb_verifications");
  }
}