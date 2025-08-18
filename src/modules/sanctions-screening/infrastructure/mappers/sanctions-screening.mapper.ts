import { SanctionsScreeningOrmEntity } from "@modules/sanctions-screening/infrastructure/orm-entities/sanctions-screening.orm-entity";
import { SanctionsScreeningEntity } from "@modules/sanctions-screening/domain/entities/sanctions-screening.entity";
import { Injectable } from "@nestjs/common";
import { BaseMapper } from '@core/infrastructure/base-mapper';

@Injectable()
export class SanctionsScreeningMapper extends BaseMapper<SanctionsScreeningEntity, SanctionsScreeningOrmEntity> {
  toOrm(domainEntity: SanctionsScreeningEntity): SanctionsScreeningOrmEntity {
    if (!domainEntity) {
      throw new Error('Domain entity is required');
    }

    const ormEntity = new SanctionsScreeningOrmEntity();
    ormEntity.id = domainEntity.id;
    ormEntity.is_active = domainEntity.isActive;
    ormEntity.created_at = domainEntity.createdAt;
    ormEntity.updated_at = domainEntity.updatedAt;
    // Map your properties from camelCase to snake_case
    // Example: ormEntity.property_name = domainEntity.propertyName;
    
    return ormEntity;
  }

  toDomain(ormEntity: SanctionsScreeningOrmEntity): SanctionsScreeningEntity {
    const entity = new SanctionsScreeningEntity({
      id: ormEntity.id,
      isActive: ormEntity.is_active,
      // Map your properties from snake_case to camelCase
      // Example: propertyName: ormEntity.property_name,
    });
    
    return entity;
  }
}