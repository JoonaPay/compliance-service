import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CreateKybVerificationUseCase } from "@modules/kyb-verification/application/usecases/create-kyb-verification.use-case";
import { CreateKybVerificationDto } from "@modules/kyb-verification/application/dto/requests/create-kyb-verification.dto";

export class CreateKybVerificationCommand {
  // Add your command properties here
  // They should match your entity properties in camelCase
  
  constructor(
    data: CreateKybVerificationDto,
    public readonly contextId: string, // e.g., userId, tenantId
  ) {
    // Transform snake_case DTO to camelCase command properties
    // Example: this.propertyName = data.property_name;
  }
}

@CommandHandler(CreateKybVerificationCommand)
export class CreateKybVerificationHandler
  implements ICommandHandler<CreateKybVerificationCommand>
{
  constructor(private readonly useCase: CreateKybVerificationUseCase) {}

  async execute(command: CreateKybVerificationCommand) {
    return this.useCase.execute(command);
  }
}