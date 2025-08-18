import { Body, Controller, Get, Param, Post, Delete, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { CreateKybVerificationCommand } from "@modules/kyb-verification/application/commands/create-kyb-verification.command";
import { UpdateKybVerificationCommand } from "@modules/kyb-verification/application/commands/update-kyb-verification.command";
import { DeleteKybVerificationCommand } from "@modules/kyb-verification/application/commands/delete-kyb-verification.command";
import { CreateKybVerificationDto } from "@modules/kyb-verification/application/dto/requests/create-kyb-verification.dto";
import { UpdateKybVerificationDto } from "@modules/kyb-verification/application/dto/requests/update-kyb-verification.dto";
import { DeleteKybVerificationDto } from "@modules/kyb-verification/application/dto/requests/delete-kyb-verification.dto";

@Controller("kyb-verifications")
export class KybVerificationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  create(@Body() dto: CreateKybVerificationDto) {
    const contextId = "extracted-from-token"; // TODO: Get from auth decorator
    const command = new CreateKybVerificationCommand(dto, contextId);
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
  update(@Param("id") id: string, @Body() dto: UpdateKybVerificationDto) {
    const contextId = "extracted-from-token"; // TODO: Get from auth decorator
    const command = new UpdateKybVerificationCommand(id, dto, contextId);
    return this.commandBus.execute(command);
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    const contextId = "extracted-from-token"; // TODO: Get from auth decorator
    const dto = new DeleteKybVerificationDto();
    dto.id = id;
    const command = new DeleteKybVerificationCommand(dto, contextId);
    return this.commandBus.execute(command);
  }
}