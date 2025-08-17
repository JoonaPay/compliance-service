import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateSanctionsScreeningsTable1755218400001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "sanctions_screenings",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "entity_id",
            type: "uuid",
            comment: "User ID or Business ID being screened",
          },
          {
            name: "entity_type",
            type: "enum",
            enum: ["INDIVIDUAL", "BUSINESS"],
          },
          {
            name: "screening_reference",
            type: "varchar",
            length: "100",
            isUnique: true,
          },
          {
            name: "screening_type",
            type: "enum",
            enum: ["ONBOARDING", "PERIODIC", "TRANSACTION", "MANUAL"],
            default: "'ONBOARDING'",
          },
          {
            name: "search_terms",
            type: "jsonb",
            comment: "Name, DOB, nationality, address, business details",
          },
          {
            name: "status",
            type: "enum",
            enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"],
            default: "'PENDING'",
          },
          {
            name: "risk_level",
            type: "enum",
            enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
            isNullable: true,
          },
          {
            name: "overall_risk_score",
            type: "decimal",
            precision: 5,
            scale: 2,
            isNullable: true,
          },
          {
            name: "worldcheck_screening",
            type: "jsonb",
            isNullable: true,
            comment: "WorldCheck screening results",
          },
          {
            name: "complyadvantage_screening",
            type: "jsonb",
            isNullable: true,
            comment: "ComplyAdvantage screening results",
          },
          {
            name: "pep_matches",
            type: "jsonb",
            isNullable: true,
            comment: "Politically Exposed Person matches",
          },
          {
            name: "sanctions_matches",
            type: "jsonb",
            isNullable: true,
            comment: "Sanctions list matches",
          },
          {
            name: "adverse_media_matches",
            type: "jsonb",
            isNullable: true,
            comment: "Adverse media mentions",
          },
          {
            name: "false_positive_flags",
            type: "jsonb",
            isNullable: true,
            comment: "Flagged false positives",
          },
          {
            name: "manual_review_required",
            type: "boolean",
            default: false,
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
          },
          {
            name: "reviewed_at",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "screening_providers",
            type: "jsonb",
            comment: "List of providers used for this screening",
          },
          {
            name: "provider_responses",
            type: "jsonb",
            isNullable: true,
            comment: "Raw responses from screening providers",
          },
          {
            name: "next_screening_date",
            type: "timestamp",
            isNullable: true,
          },
          {
            name: "screening_frequency",
            type: "enum",
            enum: ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY"],
            default: "'MONTHLY'",
          },
          {
            name: "auto_approve_threshold",
            type: "decimal",
            precision: 5,
            scale: 2,
            default: "10.00",
          },
          {
            name: "auto_reject_threshold",
            type: "decimal",
            precision: 5,
            scale: 2,
            default: "75.00",
          },
          {
            name: "completed_at",
            type: "timestamp",
            isNullable: true,
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
            name: "IDX_SANCTIONS_SCREENINGS_ENTITY_ID",
            columnNames: ["entity_id"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_ENTITY_TYPE",
            columnNames: ["entity_type"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_REFERENCE",
            columnNames: ["screening_reference"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_TYPE",
            columnNames: ["screening_type"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_STATUS",
            columnNames: ["status"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_RISK_LEVEL",
            columnNames: ["risk_level"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_MANUAL_REVIEW",
            columnNames: ["manual_review_required"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_NEXT_DATE",
            columnNames: ["next_screening_date"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_COMPLETED_AT",
            columnNames: ["completed_at"],
          }),
          new Index({
            name: "IDX_SANCTIONS_SCREENINGS_CREATED_AT",
            columnNames: ["created_at"],
          }),
        ],
      }),
      true,
    );

    // Create trigger for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_sanctions_screenings_updated_at 
      BEFORE UPDATE ON sanctions_screenings 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function to generate screening references
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION generate_screening_reference()
      RETURNS TEXT AS $$
      DECLARE
        new_reference TEXT;
        exists_check INTEGER;
      BEGIN
        LOOP
          -- Generate screening reference: SCR + YYYYMMDD + 8 random digits
          new_reference := 'SCR' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 100000000)::TEXT, 8, '0');
          
          SELECT COUNT(*) INTO exists_check 
          FROM sanctions_screenings 
          WHERE screening_reference = new_reference;
          
          IF exists_check = 0 THEN
            EXIT;
          END IF;
        END LOOP;
        
        RETURN new_reference;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Create trigger to auto-generate screening references
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_screening_reference()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.screening_reference IS NULL OR NEW.screening_reference = '' THEN
          NEW.screening_reference := generate_screening_reference();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER set_screening_reference_trigger
      BEFORE INSERT ON sanctions_screenings
      FOR EACH ROW
      EXECUTE FUNCTION set_screening_reference();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_screening_reference_trigger ON sanctions_screenings`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_sanctions_screenings_updated_at ON sanctions_screenings`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_screening_reference`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS generate_screening_reference`);
    await queryRunner.dropTable("sanctions_screenings");
  }
}