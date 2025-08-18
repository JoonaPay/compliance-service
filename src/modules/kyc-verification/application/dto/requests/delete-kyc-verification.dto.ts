import { ApiProperty } from "@nestjs/swagger";
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsUUID,
} from "class-validator";

export class DeleteKycVerificationDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  @IsDefined()
  id: string;
}