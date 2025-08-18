import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";
import { Repositories } from "@modules/kyc-verification/infrastructure/repositories";
import { Queries } from "@modules/kyc-verification/application/queries";
import { Mappers } from "@modules/kyc-verification/infrastructure/mappers";
import { UseCases } from "@modules/kyc-verification/application/domain/usecases";
import { Controllers } from "@modules/kyc-verification/application/controllers";
import { CommandHandlers } from "@modules/kyc-verification/application/commands";
import { OrmEntities } from "@modules/kyc-verification/infrastructure/orm-entities";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Services } from "@modules/kyc-verification/application/domain/services";

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
export class KycVerificationModule {}