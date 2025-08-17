import { plainToInstance, Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, validateSync, IsUrl, IsBoolean } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  PORT: number = 3002;

  @IsString()
  @IsOptional()
  APP_NAME: string = 'JoonaPay Compliance Service';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  KAFKA_BROKERS: string = 'localhost:9092';

  @IsString()
  @IsOptional()
  KAFKA_CLIENT_ID: string = 'compliance-service';

  @IsString()
  @IsOptional()
  KAFKA_GROUP_ID: string = 'compliance-service-group';

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  KAFKA_SSL: boolean = false;

  @IsString()
  @IsOptional()
  KAFKA_SASL_MECHANISM?: string;

  @IsString()
  @IsOptional()
  KAFKA_SASL_USERNAME?: string;

  @IsString()
  @IsOptional()
  KAFKA_SASL_PASSWORD?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  KYC_ENABLED: boolean = true;

  @IsString()
  @IsOptional()
  KYC_PROVIDER: string = 'jumio';

  @IsUrl()
  @IsOptional()
  JUMIO_API_URL: string = 'https://netverify.com/api';

  @IsString()
  @IsOptional()
  JUMIO_API_KEY?: string;

  @IsString()
  @IsOptional()
  JUMIO_API_SECRET?: string;

  @IsUrl()
  @IsOptional()
  JUMIO_WEBHOOK_URL?: string;

  @IsUrl()
  @IsOptional()
  ONFIDO_API_URL: string = 'https://api.onfido.com';

  @IsString()
  @IsOptional()
  ONFIDO_API_KEY?: string;

  @IsUrl()
  @IsOptional()
  ONFIDO_WEBHOOK_URL?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  KYB_ENABLED: boolean = true;

  @IsString()
  @IsOptional()
  KYB_PROVIDER: string = 'passfort';

  @IsUrl()
  @IsOptional()
  PASSFORT_API_URL: string = 'https://api.passfort.com';

  @IsString()
  @IsOptional()
  PASSFORT_API_KEY?: string;

  @IsUrl()
  @IsOptional()
  PASSFORT_WEBHOOK_URL?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  SANCTIONS_ENABLED: boolean = true;

  @IsString()
  @IsOptional()
  SANCTIONS_PROVIDER: string = 'worldcheck';

  @IsUrl()
  @IsOptional()
  WORLDCHECK_API_URL?: string;

  @IsString()
  @IsOptional()
  WORLDCHECK_API_KEY?: string;

  @IsUrl()
  @IsOptional()
  COMPLY_ADVANTAGE_API_URL: string = 'https://api.complyadvantage.com';

  @IsString()
  @IsOptional()
  COMPLY_ADVANTAGE_API_KEY?: string;

  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_PORT: number = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_DB: number = 2;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_TTL: number = 60;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_LIMIT: number = 100;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  METRICS_ENABLED: boolean = true;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  AUTO_APPROVAL_THRESHOLD: number = 0.95;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  RISK_SCORE_THRESHOLD: number = 0.7;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  MANUAL_REVIEW_THRESHOLD: number = 0.5;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  REPORTING_ENABLED: boolean = true;

  @IsString()
  @IsOptional()
  REPORT_EXPORT_PATH: string = './reports';

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  REPORT_RETENTION_DAYS: number = 2555;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const mergedConfig = Object.assign(new EnvironmentVariables(), validatedConfig);
  
  const isProduction = mergedConfig.NODE_ENV === Environment.Production;
  
  const errors = validateSync(mergedConfig, {
    skipMissingProperties: !isProduction,
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors.map(error => 
      Object.values(error.constraints || {}).join(', ')
    ).join('; ');
    
    throw new Error(`Configuration validation failed: ${errorMessages}`);
  }

  return mergedConfig;
}

export const validationSchema = validateEnvironment;