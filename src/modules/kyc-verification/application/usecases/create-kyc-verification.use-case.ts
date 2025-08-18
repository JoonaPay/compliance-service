import { KycVerificationEntity } from "@modules/kyc-verification/domain/entities/kyc-verification.entity";
import { KycVerificationRepository } from "@modules/kyc-verification/infrastructure/repositories/kyc-verification.repository";
import { CreateKycVerificationCommand } from "@modules/kyc-verification/application/commands/create-kyc-verification.command";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CreateKycVerificationUseCase {
  constructor(private readonly repository: KycVerificationRepository) {}

  async execute(command: CreateKycVerificationCommand) {
    const entity = new KycVerificationEntity(command);
    return this.repository.create(entity);
  }
}