export * from './create-kyb-verification.command';
export * from './update-kyb-verification.command';
export * from './delete-kyb-verification.command';

import { CreateKybVerificationHandler } from './create-kyb-verification.command';
import { UpdateKybVerificationHandler } from './update-kyb-verification.command';
import { DeleteKybVerificationHandler } from './delete-kyb-verification.command';

export const CommandHandlers = [
  CreateKybVerificationHandler,
  UpdateKybVerificationHandler,
  DeleteKybVerificationHandler,
];
