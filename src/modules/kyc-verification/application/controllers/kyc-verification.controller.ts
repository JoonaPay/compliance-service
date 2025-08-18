import { Body, Controller, Get, Param, Post, Delete, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { CreateKycVerificationCommand } from "@modules/kyc-verification/application/commands/create-kyc-verification.command";
import { UpdateKycVerificationCommand } from "@modules/kyc-verification/application/commands/update-kyc-verification.command";
import { DeleteKycVerificationCommand } from "@modules/kyc-verification/application/commands/delete-kyc-verification.command";
import { CreateKycVerificationDto } from "@modules/kyc-verification/application/dto/requests/create-kyc-verification.dto";
import { UpdateKycVerificationDto } from "@modules/kyc-verification/application/dto/requests/update-kyc-verification.dto";
import { DeleteKycVerificationDto } from "@modules/kyc-verification/application/dto/requests/delete-kyc-verification.dto";

@Controller("kyc-verifications")
export class KycVerificationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  create(@Body() dto: CreateKycVerificationDto) {
    const contextId = "extracted-from-token"; // TODO: Get from auth decorator
    const command = new CreateKycVerificationCommand(dto, contextId);
    return this.commandBus.execute(command);
  }

  @Get()
  findAll() {
    // TODO: Implement query handler
    throw new Error("Not implemented");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    // TODO: Implement query handler
    throw new Error("Not implemented");
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() dto: UpdateKycVerificationDto) {
    const contextId = "extracted-from-token"; // TODO: Get from auth decorator
    const command = new UpdateKycVerificationCommand(id, dto, contextId);
    return this.commandBus.execute(command);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    const contextId = "extracted-from-token"; // TODO: Get from auth decorator
    const dto = new DeleteKycVerificationDto();
    dto.id = id;
    const command = new DeleteKycVerificationCommand(dto, contextId);
    return this.commandBus.execute(command);
  }
}