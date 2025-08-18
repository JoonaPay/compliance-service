import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CreateKycVerificationUseCase } from "@modules/kyc-verification/application/usecases/create-kyc-verification.use-case";
import { CreateKycVerificationDto } from "@modules/kyc-verification/application/dto/requests/create-kyc-verification.dto";

export class CreateKycVerificationCommand {
  // Add your command properties here
  // They should match your entity properties in camelCase
  
  constructor(
    data: CreateKycVerificationDto,
    public readonly contextId: string, // e.g., userId, tenantId
  ) {
    // Transform snake_case DTO to camelCase command properties
    // Example: this.propertyName = data.property_name;
  }
}

@CommandHandler(CreateKycVerificationCommand)
export class CreateKycVerificationHandler
  implements ICommandHandler<CreateKycVerificationCommand>
{
  constructor(private readonly useCase: CreateKycVerificationUseCase) {}

  async execute(command: CreateKycVerificationCommand) {
    return this.useCase.execute(command);
  }
}