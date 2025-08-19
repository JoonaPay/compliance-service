export interface BeneficialOwner {
  id: string;
  kybVerificationId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  nationality: string;
  ownershipPercentage: number;
  isSignificantControl: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BeneficialOwnerRepository {
  save(beneficialOwner: BeneficialOwner): Promise<BeneficialOwner>;
  findById(id: string): Promise<BeneficialOwner | null>;
  findByKybVerificationId(kybVerificationId: string): Promise<BeneficialOwner[]>;
  delete(id: string): Promise<void>;
}