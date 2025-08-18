import { KybVerificationOrmEntity } from "@modules/kyb-verification/infrastructure/orm-entities/kyb-verification.orm-entity";
import { KybVerificationEntity } from "@modules/kyb-verification/domain/entities/kyb-verification.entity";
import { Injectable } from "@nestjs/common";
import { BaseMapper } from '@core/infrastructure/base-mapper';

@Injectable()
export class KybVerificationMapper extends BaseMapper<KybVerificationEntity, KybVerificationOrmEntity> {
  toOrm(domainEntity: KybVerificationEntity): KybVerificationOrmEntity {
    if (!domainEntity) {
      throw new Error('Domain entity is required');
    }

    const ormEntity = new KybVerificationOrmEntity();
    ormEntity.id = domainEntity.id;
    ormEntity.is_active = domainEntity.isActive;
    ormEntity.created_at = domainEntity.createdAt;
    ormEntity.updated_at = domainEntity.updatedAt;
    // Map your properties from camelCase to snake_case
    // Example: ormEntity.property_name = domainEntity.propertyName;
    
    return ormEntity;
  }

  toDomain(ormEntity: KybVerificationOrmEntity): KybVerificationEntity {
    const entity = new KybVerificationEntity({
      id: ormEntity.id,
      isActive: ormEntity.is_active,
      // Map your properties from snake_case to camelCase
      // Example: propertyName: ormEntity.property_name,
    });
    
    return entity;
  }
}