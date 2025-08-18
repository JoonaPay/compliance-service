import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CreateSanctionsScreeningUseCase } from "@modules/sanctions-screening/application/usecases/create-sanctions-screening.use-case";
import { CreateSanctionsScreeningDto } from "@modules/sanctions-screening/application/dto/requests/create-sanctions-screening.dto";

export class CreateSanctionsScreeningCommand {
  // Add your command properties here
  // They should match your entity properties in camelCase
  
  constructor(
    data: CreateSanctionsScreeningDto,
    public readonly contextId: string, // e.g., userId, tenantId
  ) {
    // Transform snake_case DTO to camelCase command properties
    // Example: this.propertyName = data.property_name;
  }
}

@CommandHandler(CreateSanctionsScreeningCommand)
export class CreateSanctionsScreeningHandler
  implements ICommandHandler<CreateSanctionsScreeningCommand>
{
  constructor(private readonly useCase: CreateSanctionsScreeningUseCase) {}

  async execute(command: CreateSanctionsScreeningCommand) {
    return this.useCase.execute(command);
  }
}