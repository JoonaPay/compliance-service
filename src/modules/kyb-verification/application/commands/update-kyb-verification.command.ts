import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { UpdateKybVerificationUseCase } from "@modules/kyb-verification/application/usecases/update-kyb-verification.use-case";
import { UpdateKybVerificationDto } from "@modules/kyb-verification/application/dto/requests/update-kyb-verification.dto";

export class UpdateKybVerificationCommand {
  public readonly id: string;
  // Add your command properties here
  // They should match your entity properties in camelCase
  
  constructor(
    id: string,
    data: UpdateKybVerificationDto,
    public readonly contextId: string, // e.g., userId, tenantId
  ) {
    this.id = id;
    // Transform snake_case DTO to camelCase command properties
    // Example: this.propertyName = data.property_name;
  }
}

@CommandHandler(UpdateKybVerificationCommand)
export class UpdateKybVerificationHandler
  implements ICommandHandler<UpdateKybVerificationCommand>
{
  constructor(private readonly useCase: UpdateKybVerificationUseCase) {}

  async execute(command: UpdateKybVerificationCommand) {
    return this.useCase.execute(command);
  }
}