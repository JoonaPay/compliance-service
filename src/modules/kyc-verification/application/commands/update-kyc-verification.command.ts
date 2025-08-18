import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { UpdateKycVerificationUseCase } from "@modules/kyc-verification/application/usecases/update-kyc-verification.use-case";
import { UpdateKycVerificationDto } from "@modules/kyc-verification/application/dto/requests/update-kyc-verification.dto";

export class UpdateKycVerificationCommand {
  public readonly id: string;
  // Add your command properties here
  // They should match your entity properties in camelCase
  
  constructor(
    id: string,
    data: UpdateKycVerificationDto,
    public readonly contextId: string, // e.g., userId, tenantId
  ) {
    this.id = id;
    // Transform snake_case DTO to camelCase command properties
    // Example: this.propertyName = data.property_name;
  }
}

@CommandHandler(UpdateKycVerificationCommand)
export class UpdateKycVerificationHandler
  implements ICommandHandler<UpdateKycVerificationCommand>
{
  constructor(private readonly useCase: UpdateKycVerificationUseCase) {}

  async execute(command: UpdateKycVerificationCommand) {
    return this.useCase.execute(command);
  }
}