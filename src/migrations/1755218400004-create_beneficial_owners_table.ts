import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateBeneficialOwnersTable1755218400004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "beneficial_owners",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "kyb_verification_id",
            type: "uuid",
            comment: "Associated KYB verification ID",
          },
          {
            name: "ubo_reference",
            type: "varchar",
            length: "100",
            isUnique: true,
            comment: "Unique reference for this beneficial owner",
          },
          {
            name: "owner_type",
            type: "enum",
            enum: ["INDIVIDUAL", "ENTITY"],
            comment: "Type of beneficial owner",
          },
          {
            name: "ownership_percentage",
            type: "decimal",
            precision: 5,
            scale: 2,
            comment: "Percentage of ownership (0.00 to 100.00)",
          },
          {
            name: "control_percentage",
            type: "decimal",
            precision: 5,
            scale: 2,
            isNullable: true,
            comment: "Percentage of control if different from ownership",
          },
          {
            name: "is_ultimate_beneficial_owner",
            type: "boolean",
            default: false,
            comment: "True if this is an ultimate beneficial owner (>25% ownership or control)",
          },
          {
            name: "control_mechanism",
            type: "enum",
            enum: ["DIRECT_OWNERSHIP", "INDIRECT_OWNERSHIP", "VOTING_RIGHTS", "BOARD_CONTROL", "OTHER"],
            comment: "How control is exercised",
          },
          {
            name: "control_description",
            type: "text",
            isNullable: true,
            comment: "Detailed description of control mechanism",
          },
          // Individual UBO fields
          {
            name: "first_name",
            type: "varchar",
            length: "100",
            isNullable: true,
            comment: "First name for individual UBOs",
          },
          {
            name: "middle_name",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "last_name",
            type: "varchar",
            length: "100",
            isNullable: true,
            comment: "Last name for individual UBOs",
          },
          {
            name: "date_of_birth",
            type: "date",
            isNullable: true,
            comment: "Date of birth for individual UBOs",
          },
          {
            name: "nationality",
            type: "varchar",
            length: "2",
            isNullable: true,
            comment: "ISO 3166-1 alpha-2 country code",
          },
          {
            name: "id_document_type",
            type: "enum",
            enum: ["PASSPORT", "DRIVERS_LICENSE", "NATIONAL_ID", "OTHER"],
            isNullable: true,
          },
          {
            name: "id_document_number",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "id_document_country",
            type: "varchar",
            length: "2",
            isNullable: true,
            comment: "ISO 3166-1 alpha-2 country code",
          },
          {
            name: "residential_address",
            type: "jsonb",
            isNullable: true,
            comment: "Residential address for individual UBOs",
          },
          {
            name: "occupation",
            type: "varchar",
            length: "200",
            isNullable: true,
          },
          {
            name: "employer",
            type: "varchar",
            length: "200",
            isNullable: true,
          },
          // Entity UBO fields
          {
            name: "entity_name",
            type: "varchar",
            length: "255",
            isNullable: true,
            comment: "Entity name for corporate UBOs",
          },
          {
            name: "entity_type",
            type: "enum",
            enum: ["CORPORATION", "LLC", "PARTNERSHIP", "TRUST", "FOUNDATION", "OTHER"],
            isNullable: true,
          },
          {
            name: "entity_registration_number",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "entity_jurisdiction",
            type: "varchar",
            length: "2",
            isNullable: true,
            comment: "ISO 3166-1 alpha-2 country code",
          },
          {
            name: "entity_address",
            type: "jsonb",
            isNullable: true,
            comment: "Registered address for entity UBOs",
          },
          {
            name: "entity_industry",
            type: "varchar",
            length: "200",
            isNullable: true,
          },
          // Verification and compliance fields
          {
            name: "verification_status",
            type: "enum",
            enum: ["PENDING", "VERIFIED", "REJECTED", "MANUAL_REVIEW_REQUIRED"],
            default: "'PENDING'",
          },
          {
            name: "kyc_verification_id",
            type: "uuid",
            isNullable: true,
            comment: "Link to individual KYC verification if applicable",
          },
          {
            name: "sanctions_screened",
            type: "boolean",
            default: false,
          },
          {
            name: "sanctions_screening_id",
            type: "uuid",
            isNullable: true,
            comment: "Link to sanctions screening record",
          },
          {
            name: "pep_status",
            type: "enum",
            enum: ["NOT_PEP", "PEP", "RCA", "UNKNOWN"],
            default: "'UNKNOWN'",
            comment: "Politically Exposed Person status (RCA = Related/Close Associate)",
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
            name: "document_ids",
            type: "jsonb",
            isNullable: true,
            comment: "Array of document upload IDs for this UBO",
          },
          {
            name: "verification_results",
            type: "jsonb",
            isNullable: true,
            comment: "External provider verification results",
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
            name: "verified_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "is_active",
            type: "boolean",
            default: true,
            comment: "False if this UBO is no longer associated with the business",
          },
          {
            name: "effective_from",
            type: "date",
            isNullable: true,
            comment: "Date when this ownership became effective",
          },
          {
            name: "effective_until",
            type: "date",
            isNullable: true,
            comment: "Date when this ownership ended (if applicable)",
          },
          {
            name: "source_of_information",
            type: "enum",
            enum: ["SELF_DECLARED", "CORPORATE_REGISTRY", "FINANCIAL_STATEMENTS", "OTHER_OFFICIAL", "THIRD_PARTY"],
            default: "'SELF_DECLARED'",
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
            name: "FK_BENEFICIAL_OWNERS_KYB_VERIFICATION",
            columnNames: ["kyb_verification_id"],
            referencedTableName: "kyb_verifications",
            referencedColumnNames: ["id"],
            onDelete: "CASCADE",
          },
          {
            name: "FK_BENEFICIAL_OWNERS_KYC_VERIFICATION",
            columnNames: ["kyc_verification_id"],
            referencedTableName: "kyc_verifications",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
          },
          {
            name: "FK_BENEFICIAL_OWNERS_SANCTIONS_SCREENING",
            columnNames: ["sanctions_screening_id"],
            referencedTableName: "sanctions_screenings",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
          },
        ],
      }),
      true,
    );

    // Create trigger for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_beneficial_owners_updated_at 
      BEFORE UPDATE ON beneficial_owners 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function to generate UBO references
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_ubo_reference()
      RETURNS TEXT AS $$
      DECLARE
        new_reference TEXT;
        exists_check INTEGER;
      BEGIN
        LOOP
          // Generate UBO reference: UBO + YYYYMMDD + 8 random digits
          new_reference := 'UBO' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
          
          SELECT COUNT(*) INTO exists_check 
          FROM beneficial_owners 
          WHERE ubo_reference = new_reference;
          
          IF exists_check = 0 THEN
            EXIT;
          END IF;
        END LOOP;
        
        RETURN new_reference;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to auto-generate UBO references and set UBO flag
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_ubo_reference_and_flag()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.ubo_reference IS NULL OR NEW.ubo_reference = '' THEN
          NEW.ubo_reference := generate_ubo_reference();
        END IF;
        
        // Automatically set UBO flag based on ownership percentage
        IF NEW.ownership_percentage >= 25.00 OR NEW.control_percentage >= 25.00 THEN
          NEW.is_ultimate_beneficial_owner := true;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_ubo_reference_and_flag_trigger
      BEFORE INSERT ON beneficial_owners
      FOR EACH ROW
      EXECUTE FUNCTION set_ubo_reference_and_flag();
    `);

    // Create index for ownership percentage queries
    await queryRunner.query(`
      CREATE INDEX IDX_BENEFICIAL_OWNERS_OWNERSHIP_PERCENTAGE 
      ON beneficial_owners (ownership_percentage) 
      WHERE ownership_percentage >= 25.00;
    `);

    // Create index for control percentage queries
    await queryRunner.query(`
      CREATE INDEX IDX_BENEFICIAL_OWNERS_CONTROL_PERCENTAGE 
      ON beneficial_owners (control_percentage) 
      WHERE control_percentage >= 25.00;
    `);

    // Create additional indexes
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_KYB_ID ON beneficial_owners (kyb_verification_id)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_REFERENCE ON beneficial_owners (ubo_reference)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_TYPE ON beneficial_owners (owner_type)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_UBO_FLAG ON beneficial_owners (is_ultimate_beneficial_owner)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_VERIFICATION_STATUS ON beneficial_owners (verification_status)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_PEP_STATUS ON beneficial_owners (pep_status)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_RISK_LEVEL ON beneficial_owners (risk_level)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_SANCTIONS_SCREENED ON beneficial_owners (sanctions_screened)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_ACTIVE ON beneficial_owners (is_active)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_EFFECTIVE_FROM ON beneficial_owners (effective_from)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_EFFECTIVE_UNTIL ON beneficial_owners (effective_until)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_FIRST_LAST_NAME ON beneficial_owners (first_name, last_name)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_ENTITY_NAME ON beneficial_owners (entity_name)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_ID_DOCUMENT ON beneficial_owners (id_document_number, id_document_country)`);
    await queryRunner.query(`CREATE INDEX IDX_BENEFICIAL_OWNERS_CREATED_AT ON beneficial_owners (created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_BENEFICIAL_OWNERS_CONTROL_PERCENTAGE`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_BENEFICIAL_OWNERS_OWNERSHIP_PERCENTAGE`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_ubo_reference_and_flag_trigger ON beneficial_owners`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_beneficial_owners_updated_at ON beneficial_owners`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_ubo_reference_and_flag`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_ubo_reference`);
    await queryRunner.dropTable("beneficial_owners");
  }
}