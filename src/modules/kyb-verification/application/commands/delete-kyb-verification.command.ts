import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { DeleteKybVerificationUseCase } from "@modules/kyb-verification/application/usecases/delete-kyb-verification.use-case";
import { DeleteKybVerificationDto } from "@modules/kyb-verification/application/dto/requests/delete-kyb-verification.dto";

export class DeleteKybVerificationCommand {
  public readonly id: string;
  
  constructor(
    data: DeleteKybVerificationDto,
    public readonly contextId: string, // e.g., userId, tenantId
  ) {
    this.id = data.id;
  }
}

@CommandHandler(DeleteKybVerificationCommand)
export class DeleteKybVerificationHandler
  implements ICommandHandler<DeleteKybVerificationCommand>
{
  constructor(private readonly useCase: DeleteKybVerificationUseCase) {}

  async execute(command: DeleteKybVerificationCommand) {
    return this.useCase.execute(command);
  }
}