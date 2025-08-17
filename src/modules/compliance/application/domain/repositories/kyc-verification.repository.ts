import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { KycVerification } from '../entities/kyc-verification.entity';

@Injectable()
export class KycVerificationRepository {
  constructor(
    @InjectRepository(KycVerification)
    private readonly repository: Repository<KycVerification>,
  ) {}

  async create(kycData: Partial<KycVerification>): Promise<KycVerification> {
    const kyc = this.repository.create(kycData);
    return this.repository.save(kyc);
  }

  async findById(id: string): Promise<KycVerification | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['documentVerifications', 'riskAssessment'],
    });
  }

  async findByUserId(userId: string): Promise<KycVerification[]> {
    return this.repository.find({
      where: { userId },
      relations: ['documentVerifications', 'riskAssessment'],
      order: { submittedAt: 'DESC' },
    });
  }

  async findByStatus(status: any): Promise<KycVerification[]> {
    return this.repository.find({
      where: { status },
      relations: ['documentVerifications', 'riskAssessment'],
      order: { submittedAt: 'DESC' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<KycVerification[]> {
    return this.repository.find({
      where: {
        submittedAt: Between(startDate, endDate),
      },
      relations: ['documentVerifications', 'riskAssessment'],
      order: { submittedAt: 'DESC' },
    });
  }

  async update(id: string, updateData: Partial<KycVerification>): Promise<KycVerification> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async save(kyc: KycVerification): Promise<KycVerification> {
    return this.repository.save(kyc);
  }

  async findExpired(daysAgo: number): Promise<KycVerification[]> {
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