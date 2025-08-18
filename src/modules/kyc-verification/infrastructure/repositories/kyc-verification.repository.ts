import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KycVerificationMapper } from "@modules/kyc-verification/infrastructure/mappers/kyc-verification.mapper";
import { KycVerificationOrmEntity } from "@modules/kyc-verification/infrastructure/orm-entities/kyc-verification.orm-entity";
import { KycVerificationEntity } from "@modules/kyc-verification/domain/entities/kyc-verification.entity";
import { Injectable } from "@nestjs/common";

@Injectable()
export class KycVerificationRepository {
  constructor(
    @InjectRepository(KycVerificationOrmEntity)
    private readonly repository: Repository<KycVerificationOrmEntity>,
    private readonly mapper: KycVerificationMapper,
  ) {}

  async create(entity: KycVerificationEntity): Promise<KycVerificationEntity> {
    const ormEntity = this.mapper.toOrm(entity);
    const savedOrmEntity = await this.repository.save(ormEntity);
    return this.mapper.toDomain(savedOrmEntity);
  }

  async findById(id: string): Promise<KycVerificationEntity | null> {
    const ormEntity = await this.repository.findOne({
      where: { id },
    });
    if (!ormEntity) {
      return null;
    }
    return this.mapper.toDomain(ormEntity);
  }

  async findAll(): Promise<KycVerificationEntity[]> {
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
    entity: KycVerificationEntity,
  ): Promise<KycVerificationEntity> {
    const ormEntity = this.mapper.toOrm(entity);
    await this.repository.update(id, ormEntity);
    return entity;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}