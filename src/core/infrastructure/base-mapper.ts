import { BaseDomainEntity } from '@core/domain/base-domain-entity';
import { BaseOrmEntity } from './base-orm-entity';

export abstract class BaseMapper<
  DomainEntity extends BaseDomainEntity,
  OrmEntity extends BaseOrmEntity,
> {
  abstract toDomain(ormEntity: OrmEntity): DomainEntity;
  abstract toOrm(domainEntity: DomainEntity): OrmEntity;

  toDomainBulk(ormEntities: OrmEntity[]): DomainEntity[] {
    return ormEntities.map((ormEntity) => this.toDomain(ormEntity));
  }

  toOrmBulk(domainEntities: DomainEntity[]): OrmEntity[] {
    return domainEntities.map((domainEntity) => this.toOrm(domainEntity));
  }
}