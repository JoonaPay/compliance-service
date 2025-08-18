import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { Repositories } from "@modules/kyb-verification/infrastructure/repositories";
import { Queries } from "@modules/kyb-verification/application/queries";
import { Mappers } from "@modules/kyb-verification/infrastructure/mappers";
import { UseCases } from "@modules/kyb-verification/application/domain/usecases";
import { Controllers } from "@modules/kyb-verification/application/controllers";
import { CommandHandlers } from "@modules/kyb-verification/application/commands";
import { OrmEntities } from "@modules/kyb-verification/infrastructure/orm-entities";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Services } from "@modules/kyb-verification/application/domain/services";

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
export class KybVerificationModule {}