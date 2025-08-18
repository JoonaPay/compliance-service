import { SanctionsscreeningEntity } from "@modules/sanctions-screening/domain/entities/sanctions-screening.entity";
import { SanctionsscreeningRepository } from "@modules/sanctions-screening/infrastructure/repositories/sanctions-screening.repository";
import { CreateSanctionsscreeningCommand } from "@modules/sanctions-screening/application/commands/create-sanctions-screening.command";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CreateSanctionsscreeningUseCase {
  constructor(private readonly repository: SanctionsscreeningRepository) {}

  async execute(command: CreateSanctionsscreeningCommand) {
    const entity = new SanctionsscreeningEntity(command);
    return this.repository.create(entity);
  }
}