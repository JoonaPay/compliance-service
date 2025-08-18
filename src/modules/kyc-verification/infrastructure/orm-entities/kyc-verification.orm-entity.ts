import { Column, Entity } from "typeorm";
import { BaseOrmEntity } from '@core/infrastructure/base-orm-entity';

@Entity("kyc_verifications")
export class KycVerificationOrmEntity extends BaseOrmEntity {
  @Column({ name: "is_active", default: true })
  is_active?: boolean;

  // Add your columns here
  // Example:
  // @Column()
  // property_name: string;
}