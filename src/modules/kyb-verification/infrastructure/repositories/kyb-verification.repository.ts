import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KybVerificationMapper } from "@modules/kyb-verification/infrastructure/mappers/kyb-verification.mapper";
import { KybVerificationOrmEntity } from "@modules/kyb-verification/infrastructure/orm-entities/kyb-verification.orm-entity";
import { KybVerificationEntity } from "@modules/kyb-verification/domain/entities/kyb-verification.entity";
import { Injectable } from "@nestjs/common";

@Injectable()
export class KybVerificationRepository {
  constructor(
    @InjectRepository(KybVerificationOrmEntity)
    private readonly repository: Repository<KybVerificationOrmEntity>,
    private readonly mapper: KybVerificationMapper,
  ) {}

  async create(entity: KybVerificationEntity): Promise<KybVerificationEntity> {
    const ormEntity = this.mapper.toOrm(entity);
    const savedOrmEntity = await this.repository.save(ormEntity);
    return this.mapper.toDomain(savedOrmEntity);
  }

  async findById(id: string): Promise<KybVerificationEntity | null> {
    const ormEntity = await this.repository.findOne({
      where: { id },
    });
    if (!ormEntity) {
      return null;
    }
    return this.mapper.toDomain(ormEntity);
  }

  async findAll(): Promise<KybVerificationEntity[]> {
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
    entity: KybVerificationEntity,
  ): Promise<KybVerificationEntity> {
    const ormEntity = this.mapper.toOrm(entity);
    await this.repository.update(id, ormEntity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}