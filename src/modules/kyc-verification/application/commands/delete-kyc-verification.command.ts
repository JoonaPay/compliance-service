import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { DeleteKycVerificationUseCase } from "@modules/kyc-verification/application/usecases/delete-kyc-verification.use-case";
import { DeleteKycVerificationDto } from "@modules/kyc-verification/application/dto/requests/delete-kyc-verification.dto";

export class DeleteKycVerificationCommand {
  public readonly id: string;
  
  constructor(
    data: DeleteKycVerificationDto,
    public readonly contextId: string, // e.g., userId, tenantId
  ) {
    this.id = data.id;
  }
}

@CommandHandler(DeleteKycVerificationCommand)
export class DeleteKycVerificationHandler
  implements ICommandHandler<DeleteKycVerificationCommand>
{
  constructor(private readonly useCase: DeleteKycVerificationUseCase) {}

  async execute(command: DeleteKycVerificationCommand) {
    return this.useCase.execute(command);
  }
}