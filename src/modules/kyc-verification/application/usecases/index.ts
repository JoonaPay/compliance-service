export * from './create-kyc-verification.use-case';
export * from './update-kyc-verification.use-case';
export * from './delete-kyc-verification.use-case';

import { CreateKycVerificationUseCase } from './create-kyc-verification.use-case';
import { UpdateKycVerificationUseCase } from './update-kyc-verification.use-case';
import { DeleteKycVerificationUseCase } from './delete-kyc-verification.use-case';

export const UseCases = [
  CreateKycVerificationUseCase,
  UpdateKycVerificationUseCase,
  DeleteKycVerificationUseCase,
];