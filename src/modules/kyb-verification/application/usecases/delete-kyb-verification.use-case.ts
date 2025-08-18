import { KybVerificationRepository } from "@modules/kyb-verification/infrastructure/repositories/kyb-verification.repository";
import { DeleteKybVerificationCommand } from "@modules/kyb-verification/application/commands/delete-kyb-verification.command";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DeleteKybVerificationUseCase {
  constructor(private readonly repository: KybVerificationRepository) {}

  async execute(command: DeleteKybVerificationCommand) {
    // Check if entity exists before deletion
    const existingEntity = await this.repository.findById(command.id);
    if (!existingEntity) {
      throw new Error(`KybVerification with id ${command.id} not found`);
    }
    
    await this.repository.delete(command.id);
  }
}