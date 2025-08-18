import { KybVerificationEntity } from "@modules/kyb-verification/domain/entities/kyb-verification.entity";
import { KybVerificationRepository } from "@modules/kyb-verification/infrastructure/repositories/kyb-verification.repository";
import { CreateKybVerificationCommand } from "@modules/kyb-verification/application/commands/create-kyb-verification.command";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CreateKybVerificationUseCase {
  constructor(private readonly repository: KybVerificationRepository) {}

  async execute(command: CreateKybVerificationCommand) {
    const entity = new KybVerificationEntity(command);
    return this.repository.create(entity);
  }
}