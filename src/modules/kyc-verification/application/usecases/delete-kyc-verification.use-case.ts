import { KycVerificationRepository } from "@modules/kyc-verification/infrastructure/repositories/kyc-verification.repository";
import { DeleteKycVerificationCommand } from "@modules/kyc-verification/application/commands/delete-kyc-verification.command";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DeleteKycVerificationUseCase {
  constructor(private readonly repository: KycVerificationRepository) {}

  async execute(command: DeleteKycVerificationCommand) {
    // Check if entity exists before deletion
    const existingEntity = await this.repository.findById(command.id);
    if (!existingEntity) {
      throw new Error(`KycVerification with id ${command.id} not found`);
    }
    
    await this.repository.delete(command.id);
  }
}