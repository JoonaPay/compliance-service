import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { Repositories } from "@modules/sanctions-screening/infrastructure/repositories";
import { Queries } from "@modules/sanctions-screening/application/queries";
import { Mappers } from "@modules/sanctions-screening/infrastructure/mappers";
import { UseCases } from "@modules/sanctions-screening/application/domain/usecases";
import { Controllers } from "@modules/sanctions-screening/application/controllers";
import { CommandHandlers } from "@modules/sanctions-screening/application/commands";
import { OrmEntities } from "@modules/sanctions-screening/infrastructure/orm-entities";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Services } from "@modules/sanctions-screening/application/domain/services";

@Module({
  imports: [TypeOrmModule.forFeature([...OrmEntities]), CqrsModule],
  providers: [
    ...CommandHandlers,
    ...Queries,
    ...Repositories,
    ...Mappers,
    ...UseCases,
    ...Services,
  ],
  controllers: [...Controllers],
})
export class SanctionsScreeningModule {}