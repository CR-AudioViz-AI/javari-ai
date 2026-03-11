# Implement Machine Learning Fraud Detection Service

# Fraud Detection Service Documentation

## Purpose
The Fraud Detection Service provides machine learning capabilities to analyze and assess the risk of transactions in real-time. It is designed to identify potentially fraudulent activities by utilizing various models and extracting relevant features from transaction data.

## Usage
The service can be used to assess the fraud risk of financial transactions. It expects transaction data as input and returns a risk assessment that includes a risk score, risk level, and recommendations on whether the transaction should be blocked.

## Parameters/Props

### TransactionData
The interface for input transaction data includes:
- `id` (string): Unique identifier for the transaction.
- `userId` (string): Identifier for the user making the transaction.
- `amount` (number): Transaction amount.
- `currency` (string): Currency code (e.g., "USD", "EUR").
- `merchantId` (string): Identifier for the merchant involved.
- `timestamp` (Date): The date and time of the transaction.
- `ipAddress` (string): User's IP address.
- `userAgent` (string): User's device information.
- `geolocation` (object): Geographic location details including `latitude`, `longitude`, `country`, and `city`.
- `paymentMethod` (object): Payment information including `type`, `lastFour`, and `issuer`.
- `metadata` (Record<string, any>): Additional data related to the transaction.

### FraudRiskAssessment
The output of the fraud detection service includes:
- `transactionId` (string): ID of the assessed transaction.
- `riskScore` (number): Numerical score indicating risk level.
- `riskLevel` (string): Categorical risk level - 'low', 'medium', 'high', 'critical'.
- `shouldBlock` (boolean): Recommendation to block the transaction or not.
- `reasons` (string[]): List of reasons for the risk assessment.
- `modelScores` (object): Scores from different ML models (e.g., random forest, neural network).
- `features` (TransactionFeatures): Extracted features used for assessment.
- `confidence` (number): Confidence level of the assessment.
- `processingTimeMs` (number): Time taken to process the transaction (in milliseconds).

### TransactionFeatures
This interface contains features extracted for machine learning models:
- `amount` (number): Transaction amount.
- `amountLog` (number): Logarithm of the transaction amount.
- `hourOfDay` (number): Hour the transaction occurred.
- `dayOfWeek` (number): Day of the week the transaction occurred.
- `velocityLast1h` (number): Number of transactions in the last hour.
- `velocityLast24h` (number): Number of transactions in the last 24 hours.
- `velocityLast7d` (number): Number of transactions in the last 7 days.
- `avgTransactionAmount` (number): Average amount of transactions over time.
- `deviationFromAvg` (number): Deviation from the average transaction amount.
- `timeSinceLastTransaction` (number): Time elapsed since the last transaction.
- `distinctMerchantsLast24h` (number): Unique merchants engaged with in the last 24 hours.
- `geolocationRisk` (number): Risk score based on geolocation.
- `deviceRisk` (number): Risk score based on device type.
- `paymentMethodRisk` (number): Risk score associated with the payment method.
- `timeFromRegistration` (number): Time elapsed since user registration.
- `isWeekend` (boolean): Indicates if transaction occurred on a weekend.
- `isNightTime` (boolean): Indicates if transaction occurred at night.

## Return Values
The service returns a `FraudRiskAssessment` object containing the risk assessment details based on the submitted transaction data.

## Example

```typescript
import { FraudDetectionService } from './services/ml-fraud-detection/fraud-detection.service';

const transaction: TransactionData = {
  id: 'txn_123',
  userId: 'user_456',
  amount: 250.00,
  currency: 'USD',
  merchantId: 'merchant_789',
  timestamp: new Date(),
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0',
  geolocation: {
    latitude: 37.7749,
    longitude: -122.4194,
    country: 'USA',
    city: 'San Francisco'
  },
  paymentMethod: {
    type: 'card',
    lastFour: '1234',
    issuer: 'Visa'
  },
  metadata: {}
};

const assessment = await FraudDetectionService.assessFraud(transaction);
console.log(assessment);
```

This example demonstrates how to utilize the Fraud Detection Service to obtain a risk assessment for a specified transaction.