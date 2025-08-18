import { KybVerificationEntity } from "@modules/kyb-verification/domain/entities/kyb-verification.entity";
import { KybVerificationRepository } from "@modules/kyb-verification/infrastructure/repositories/kyb-verification.repository";
import { UpdateKybVerificationCommand } from "@modules/kyb-verification/application/commands/update-kyb-verification.command";
import { Injectable } from "@nestjs/common";

@Injectable()
export class UpdateKybVerificationUseCase {
  constructor(private readonly repository: KybVerificationRepository) {}

  async execute(command: UpdateKybVerificationCommand) {
    // Find existing entity
    const existingEntity = await this.repository.findById(command.id);
    if (!existingEntity) {
      throw new Error(`KybVerification with id ${command.id} not found`);
    }
    
    // Create updated entity
    const updatedEntity = new KybVerificationEntity({
      ...existingEntity,
      ...command,
    });
    
    return this.repository.update(command.id, updatedEntity);
  }
}