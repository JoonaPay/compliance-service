import { ApiProperty } from "@nestjs/swagger";
import {
  IsDefined,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsUUID,
} from "class-validator";

export class UpdateKybVerificationDto {
  // Add your DTO properties here in snake_case
  // Example:
  // @ApiProperty()
  // @IsString()
  // @IsNotEmpty()
  // @IsDefined()
  // property_name: string;
}