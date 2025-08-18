import { KycVerificationOrmEntity } from "@modules/kyc-verification/infrastructure/orm-entities/kyc-verification.orm-entity";
import { KycVerificationEntity } from "@modules/kyc-verification/domain/entities/kyc-verification.entity";
import { Injectable } from "@nestjs/common";
import { BaseMapper } from '@core/infrastructure/base-mapper';

@Injectable()
export class KycVerificationMapper extends BaseMapper<KycVerificationEntity, KycVerificationOrmEntity> {
  toOrm(domainEntity: KycVerificationEntity): KycVerificationOrmEntity {
    if (!domainEntity) {
      throw new Error('Domain entity is required');
    }

    const ormEntity = new KycVerificationOrmEntity();
    ormEntity.id = domainEntity.id;
    ormEntity.is_active = domainEntity.isActive;
    ormEntity.created_at = domainEntity.createdAt;
    ormEntity.updated_at = domainEntity.updatedAt;
    // Map your properties from camelCase to snake_case
    // Example: ormEntity.property_name = domainEntity.propertyName;
    
    return ormEntity;
  }

  toDomain(ormEntity: KycVerificationOrmEntity): KycVerificationEntity {
    const entity = new KycVerificationEntity({
      id: ormEntity.id,
      isActive: ormEntity.is_active,
      // Map your properties from snake_case to camelCase
      // Example: propertyName: ormEntity.property_name,
    });
    
    return entity;
  }
}