import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CreateSanctionsscreeningUseCase } from "@modules/sanctions-screening/application/usecases/create-sanctions-screening.use-case";
import { CreateSanctionsscreeningDto } from "@modules/sanctions-screening/application/dto/requests/create-sanctions-screening.dto";

export class CreateSanctionsscreeningCommand {
  // Add your command properties here
  // They should match your entity properties in camelCase
  
  constructor(
    data: CreateSanctionsscreeningDto,
    public readonly contextId: string, // e.g., userId, tenantId
  ) {
    // Transform snake_case DTO to camelCase command properties
    // Example: this.propertyName = data.property_name;
  }
}

@CommandHandler(CreateSanctionsscreeningCommand)
export class CreateSanctionsscreeningHandler
  implements ICommandHandler<CreateSanctionsscreeningCommand>
{
  constructor(private readonly useCase: CreateSanctionsscreeningUseCase) {}

  async execute(command: CreateSanctionsscreeningCommand) {
    return this.useCase.execute(command);
  }
}