export * from './create-kyb-verification.use-case';
export * from './update-kyb-verification.use-case';
export * from './delete-kyb-verification.use-case';

import { CreateKybVerificationUseCase } from './create-kyb-verification.use-case';
import { UpdateKybVerificationUseCase } from './update-kyb-verification.use-case';
import { DeleteKybVerificationUseCase } from './delete-kyb-verification.use-case';

export const UseCases = [
  CreateKybVerificationUseCase,
  UpdateKybVerificationUseCase,
  DeleteKybVerificationUseCase,
];