# Compliance Service

## 🛡️ Overview

The Compliance Service is the regulatory compliance and verification backbone of the JoonaPay platform, providing comprehensive KYC (Know Your Customer), KYB (Know Your Business), sanctions screening, and regulatory reporting capabilities. It ensures that all financial operations meet global compliance standards while maintaining a seamless user experience.

## 🎯 Key Features

### KYC (Know Your Customer) Verification
- **Multi-Tier Verification**: Progressive verification levels based on transaction volumes
  - Basic: Name, email, phone verification
  - Standard: Government ID and address verification
  - Enhanced: Source of funds and wealth verification
- **Document Verification**: AI-powered document analysis and validation
- **Biometric Verification**: Facial recognition and liveness detection
- **Real-Time Identity Checks**: Integration with global identity verification providers
- **Risk-Based Approach**: Dynamic verification requirements based on risk profile

### KYB (Know Your Business) Verification
- **Business Entity Verification**: Company registration and legal status validation
- **Beneficial Ownership**: Ultimate beneficial owner (UBO) identification
- **Corporate Structure**: Shareholding and control structure analysis
- **Business Documentation**: Articles of incorporation, tax documents, licenses
- **Ongoing Monitoring**: Continuous compliance monitoring and updates

### Sanctions Screening
- **Real-Time Screening**: Instant checks against global sanctions lists
- **Watchlist Monitoring**: PEP (Politically Exposed Persons), adverse media, and watchlists
- **Fuzzy Matching**: Advanced name matching algorithms for accurate screening
- **Batch Screening**: Bulk screening for existing customer base
- **Continuous Monitoring**: Ongoing screening with daily list updates

### Regulatory Reporting
- **Automated Reporting**: SAR (Suspicious Activity Reports) and CTR (Currency Transaction Reports)
- **Audit Trail**: Complete compliance activity logging
- **Regulatory Dashboard**: Real-time compliance metrics and status
- **Document Management**: Secure storage and retrieval of compliance documents
- **Compliance Calendar**: Regulatory deadline tracking and notifications

## 🚀 Getting Started

### Prerequisites
```bash
- Node.js 18+
- PostgreSQL 14+
- Redis (for caching)
- Docker (optional)
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/JoonaPay/compliance-service.git
cd compliance-service
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration including API keys for verification providers
```

4. Run database migrations:
```bash
npm run migration:run
```

5. Start the service:
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## 📚 API Documentation

### Authentication
All API requests require JWT authentication:
```bash
Authorization: Bearer <jwt_token>
```

### Core Endpoints

#### KYC Verification
```typescript
POST   /api/kyc/submit                 // Submit KYC documents
GET    /api/kyc/:userId                // Get KYC status
POST   /api/kyc/:userId/verify         // Trigger verification
PUT    /api/kyc/:userId/approve        // Manual approval
PUT    /api/kyc/:userId/reject         // Reject with reason
GET    /api/kyc/:userId/documents      // List submitted documents
```

#### KYB Verification
```typescript
POST   /api/kyb/submit                 // Submit business verification
GET    /api/kyb/:businessId            // Get KYB status
POST   /api/kyb/:businessId/ubo        // Submit UBO information
PUT    /api/kyb/:businessId/approve    // Approve business
GET    /api/kyb/:businessId/report     // Get verification report
```

#### Sanctions Screening
```typescript
POST   /api/screening/check            // Screen individual/entity
GET    /api/screening/:id              // Get screening results
POST   /api/screening/batch            // Batch screening
GET    /api/screening/alerts           // List screening alerts
PUT    /api/screening/:id/clear        // Clear false positive
```

#### Compliance Management
```typescript
GET    /api/compliance/dashboard       // Compliance overview
GET    /api/compliance/reports         // List compliance reports
POST   /api/compliance/sar             // File SAR
GET    /api/compliance/audit-trail     // Get audit logs
GET    /api/compliance/risk-score/:id  // Get entity risk score
```

## 🏗️ Architecture

### Domain-Driven Design (DDD)
```
src/
├── modules/
│   ├── kyc-verification/
│   │   ├── domain/           # KYC business logic
│   │   ├── application/      # Verification workflows
│   │   └── infrastructure/   # External provider integrations
│   ├── kyb-verification/
│   │   ├── domain/           # KYB entity verification
│   │   ├── application/      # Business verification logic
│   │   └── infrastructure/   # Business data providers
│   └── sanctions-screening/
│       ├── domain/           # Screening algorithms
│       ├── application/      # Screening workflows
│       └── infrastructure/   # Sanctions list providers
└── core/                      # Shared compliance utilities
```

### Key Domain Entities

#### KYC Verification Entity
```typescript
class KycVerification {
  id: string;
  userId: string;
  verificationType: KycVerificationType;
  status: KycStatus;
  riskScore: number;
  documents: Document[];
  verificationResults: VerificationResult[];
  
  // Business Methods
  submit(): void;
  approve(): void;
  reject(reason: string): void;
  requestAdditionalDocuments(): void;
  calculateRiskScore(): number;
}
```

#### Sanctions Screening Entity
```typescript
class SanctionsScreening {
  id: string;
  entityId: string;
  entityType: EntityType;
  screeningType: ScreeningType;
  status: ScreeningStatus;
  matches: Match[];
  riskLevel: RiskLevel;
  
  // Business Methods
  screen(): void;
  reviewMatch(matchId: string): void;
  clearFalsePositive(matchId: string): void;
  escalate(): void;
  generateReport(): Report;
}
```

## 🔍 Verification Workflow

### KYC Progressive Verification
```
Level 1: Basic Verification
├── Email verification
├── Phone verification
└── Basic identity check

Level 2: Standard Verification  
├── Government ID verification
├── Address proof
├── Facial recognition
└── Sanctions screening

Level 3: Enhanced Due Diligence
├── Source of funds
├── Source of wealth
├── Enhanced background checks
└── Ongoing monitoring
```

### Risk Scoring Algorithm
```typescript
Risk Score = Base Score 
  + Country Risk Factor
  + Transaction Pattern Risk
  + PEP/Sanctions Risk
  + Document Quality Score
  - Verification Completeness

Risk Levels:
- Low Risk: 0-30
- Medium Risk: 31-60
- High Risk: 61-85
- Critical Risk: 86-100
```

## 🔐 Security & Privacy

### Data Protection
- **Encryption**: All PII encrypted at rest and in transit
- **Data Minimization**: Only collect necessary information
- **Access Control**: Role-based access to sensitive data
- **Data Retention**: Automated deletion per regulatory requirements

### Compliance Standards
- **GDPR**: Full compliance with data protection regulations
- **AML/CFT**: Anti-money laundering and counter-terrorist financing
- **FATF**: Financial Action Task Force recommendations
- **PCI DSS**: Payment card industry standards

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:cov
```

## 📊 Monitoring

- **Health Check**: `GET /health`
- **Metrics**: `GET /metrics` (Prometheus format)
- **OpenAPI Spec**: `GET /api-docs`

### Key Metrics
- Verification success/failure rates
- Average verification time
- False positive rates
- Document rejection reasons
- Provider API response times

## 🚢 Deployment

### Docker
```bash
docker build -t compliance-service .
docker run -p 3000:3000 compliance-service
```

### Kubernetes
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 🔄 Event-Driven Integration

### Published Events
- `KYCVerificationCompleted`
- `KYCVerificationFailed`
- `KYBVerificationCompleted`
- `SanctionsAlertGenerated`
- `ComplianceRiskUpdated`
- `DocumentUploaded`

### Consumed Events
- `UserRegistered` (from Identity Service)
- `BusinessEntityCreated` (from Business Entity Service)
- `TransactionProcessed` (from Ledger Service)
- `AMLAlertGenerated` (from AML Risk Manager)

## 🔗 External Integrations

### Identity Verification Providers
- Jumio
- Onfido
- Sumsub
- Trulioo

### Sanctions & Watchlist Providers
- Dow Jones
- Refinitiv World-Check
- ComplyAdvantage
- LexisNexis

### Business Verification
- Dun & Bradstreet
- Bureau van Dijk
- Companies House (UK)
- OpenCorporates

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is part of the JoonaPay platform and is proprietary software.

## 🔗 Related Services

- [Business Entity Service](https://github.com/JoonaPay/business-entity-service)
- [Identity Manager Service](https://github.com/JoonaPay/identity-manager-service)
- [Ledger Service](https://github.com/JoonaPay/ledger-service)
- [AML Risk Manager Service](https://github.com/JoonaPay/aml-risk-manager-service)

## 📞 Support

For questions and support, please contact the JoonaPay engineering team.

---

Built with ❤️ by the JoonaPay Team