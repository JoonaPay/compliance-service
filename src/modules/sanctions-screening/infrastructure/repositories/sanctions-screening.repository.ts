import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SanctionsScreeningMapper } from "@modules/sanctions-screening/infrastructure/mappers/sanctions-screening.mapper";
import { SanctionsScreeningOrmEntity } from "@modules/sanctions-screening/infrastructure/orm-entities/sanctions-screening.orm-entity";
import { SanctionsScreeningEntity } from "@modules/sanctions-screening/domain/entities/sanctions-screening.entity";
import { Injectable } from "@nestjs/common";

@Injectable()
export class SanctionsScreeningRepository {
  constructor(
    @InjectRepository(SanctionsScreeningOrmEntity)
    private readonly repository: Repository<SanctionsScreeningOrmEntity>,
    private readonly mapper: SanctionsScreeningMapper,
  ) {}

  async create(entity: SanctionsScreeningEntity): Promise<SanctionsScreeningEntity> {
    const ormEntity = this.mapper.toOrm(entity);
    const savedOrmEntity = await this.repository.save(ormEntity);
    return this.mapper.toDomain(savedOrmEntity);
  }

  async findById(id: string): Promise<SanctionsScreeningEntity | null> {
    const ormEntity = await this.repository.findOne({
      where: { id },
    });
    if (!ormEntity) {
      return null;
    }
    return this.mapper.toDomain(ormEntity);
  }

  async findAll(): Promise<SanctionsScreeningEntity[]> {
    const ormEntities = await this.repository.find();
    if (!ormEntities) {
      return [];
    }
    return ormEntities.map((ormEntity) =>
      this.mapper.toDomain(ormEntity),
    );
  }

  async update(
    id: string,
    entity: SanctionsScreeningEntity,
  ): Promise<SanctionsScreeningEntity> {
    const ormEntity = this.mapper.toOrm(entity);
    await this.repository.update(id, ormEntity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}