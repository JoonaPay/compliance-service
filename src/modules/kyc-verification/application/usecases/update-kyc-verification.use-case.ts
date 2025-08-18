import { KycVerificationEntity } from "@modules/kyc-verification/domain/entities/kyc-verification.entity";
import { KycVerificationRepository } from "@modules/kyc-verification/infrastructure/repositories/kyc-verification.repository";
import { UpdateKycVerificationCommand } from "@modules/kyc-verification/application/commands/update-kyc-verification.command";
import { Injectable } from "@nestjs/common";

@Injectable()
export class UpdateKycVerificationUseCase {
  constructor(private readonly repository: KycVerificationRepository) {}

  async execute(command: UpdateKycVerificationCommand) {
    // Find existing entity
    const existingEntity = await this.repository.findById(command.id);
    if (!existingEntity) {
      throw new Error(`KycVerification with id ${command.id} not found`);
    }
    
    // Create updated entity
    const updatedEntity = new KycVerificationEntity({
      ...existingEntity,
      ...command,
    });
    
    return this.repository.update(command.id, updatedEntity);
  }
}