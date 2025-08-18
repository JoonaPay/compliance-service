export * from './create-kyc-verification.command';
export * from './update-kyc-verification.command';
export * from './delete-kyc-verification.command';

import { CreateKycVerificationHandler } from './create-kyc-verification.command';
import { UpdateKycVerificationHandler } from './update-kyc-verification.command';
import { DeleteKycVerificationHandler } from './delete-kyc-verification.command';

export const CommandHandlers = [
  CreateKycVerificationHandler,
  UpdateKycVerificationHandler,
  DeleteKycVerificationHandler,
];
