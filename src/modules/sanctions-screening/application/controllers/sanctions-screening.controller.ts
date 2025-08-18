import { Body, Controller, Get, Param, Post, Delete, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { CreateSanctionsscreeningCommand } from "@modules/sanctions-screening/application/commands/create-sanctions-screening.command";
import { CreateSanctionsscreeningDto } from "@modules/sanctions-screening/application/dto/requests/create-sanctions-screening.dto";

@Controller("sanctions-screenings")
export class SanctionsscreeningController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  create(@Body() dto: CreateSanctionsscreeningDto) {
    const contextId = "extracted-from-token"; // TODO: Get from auth decorator
    const command = new CreateSanctionsscreeningCommand(dto, contextId);
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
  update(@Param("id") id: string, @Body() dto: any) {
    // TODO: Implement update command
    throw new Error("Not implemented");
  }

  @Delete(":id")
  delete(@Param("id") id: string) {
    // TODO: Implement delete command
    throw new Error("Not implemented");
  }
}