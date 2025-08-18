import { BaseDomainEntity } from '@core/domain/base-domain-entity';

export interface KybVerificationEntityProps {
  id?: string;
  isActive?: boolean;
  // Add your domain properties here
  // Example: name: string;
}

export class KybVerificationEntity extends BaseDomainEntity {
  public readonly isActive?: boolean;
  // Add your domain properties here
  // Example: public readonly name: string;

  constructor(props: KybVerificationEntityProps) {
    super(props.id);
    this.isActive = props.isActive;
  }
}