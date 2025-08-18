import { BaseDomainEntity } from '@core/domain/base-domain-entity';

export interface SanctionsScreeningEntityProps {
  id?: string;
  isActive?: boolean;
  // Add your domain properties here
  // Example: name: string;
}

export class SanctionsScreeningEntity extends BaseDomainEntity {
  public readonly isActive?: boolean;
  // Add your domain properties here
  // Example: public readonly name: string;

  constructor(props: SanctionsScreeningEntityProps) {
    super(props.id);
    this.isActive = props.isActive;
  }
}