import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { KybVerification } from '../entities/kyb-verification.entity';

@Injectable()
export class KybVerificationRepository {
  constructor(
    @InjectRepository(KybVerification)
    private readonly repository: Repository<KybVerification>,
  ) {}

  async create(kybData: Partial<KybVerification>): Promise<KybVerification> {
    const kyb = this.repository.create(kybData);
    return this.repository.save(kyb);
  }

  async findById(id: string): Promise<KybVerification | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['documentVerifications', 'riskAssessment'],
    });
  }

  async findByBusinessId(businessId: string): Promise<KybVerification[]> {
    return this.repository.find({
      where: { businessId },
      relations: ['documentVerifications', 'riskAssessment'],
      order: { submittedAt: 'DESC' },
    });
  }

  async findByStatus(status: any): Promise<KybVerification[]> {
    return this.repository.find({
      where: { status },
      relations: ['documentVerifications', 'riskAssessment'],
      order: { submittedAt: 'DESC' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<KybVerification[]> {
    return this.repository.find({
      where: {
        submittedAt: Between(startDate, endDate),
      },
      relations: ['documentVerifications', 'riskAssessment'],
      order: { submittedAt: 'DESC' },
    });
  }

  async update(id: string, updateData: Partial<KybVerification>): Promise<KybVerification> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async save(kyb: KybVerification): Promise<KybVerification> {
    return this.repository.save(kyb);
  }

  async findExpired(daysAgo: number): Promise<KybVerification[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    return this.repository.find({
      where: {
        submittedAt: Between(new Date(0), cutoffDate),
        status: 'pending' as any,
      },
    });
  }

  async count(): Promise<number> {
    return this.repository.count();
  }

  async countByStatus(status: any): Promise<number> {
    return this.repository.count({ where: { status } });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}