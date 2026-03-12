# Build Advanced Fraud Detection API

# Advanced Fraud Detection API

## Purpose
The Advanced Fraud Detection API provides a mechanism for identifying fraudulent transactions by analyzing various risk factors associated with each transaction. By utilizing velocity, geographical, behavioral, and amount risk assessments, the API generates a risk score and indicates whether to approve, review, or decline the transaction.

## Usage
This API is designed for use in applications that require transaction verification through fraud detection. It processes incoming transaction data, evaluates the risk, and returns the results based on pre-defined risk factors.

## Parameters / Props
The API accepts a POST request with a JSON body containing the following fields:

### TransactionData
- **userId**: `string` (UUID) - Unique identifier for the user.
- **amount**: `number` (positive float) - Transaction amount.
- **currency**: `string` (exactly 3 characters) - Currency code (e.g., "USD").
- **location**: `object` 
  - **lat**: `number` (range: -90 to 90) - Latitude of the transaction location.
  - **lng**: `number` (range: -180 to 180) - Longitude of the transaction location.
  - **country**: `string` (2 to 3 characters) - Country code.
  - **city**: `string` (1 to 100 characters) - City of the transaction.
- **timestamp**: `string` (ISO datetime) - Time when the transaction occurred.
- **paymentMethod**: `string` (enum: 'CARD', 'BANK', 'WALLET', 'CRYPTO') - Method of payment used.
- **merchantId**: `string` - Unique identifier for the merchant.
- **deviceFingerprint**: `string` (optional) - Optional fingerprint for the device used in the transaction.

### RiskFactors
- **velocityRisk**: `number` - Risk assessment based on transaction frequency.
- **geographicRisk**: `number` - Risk assessment based on geographical location.
- **behavioralRisk**: `number` - Risk assessment based on user behavior.
- **amountRisk**: `number` - Risk assessment based on transaction amount.

### FraudDetectionResult
- **riskScore**: `number` - Overall score indicating the level of fraudulent risk.
- **decision**: `string` (enum: 'APPROVE', 'REVIEW', 'DECLINE') - Recommended action based on risk assessment.
- **reasons**: `array<string>` - List of reasons justifying the decision.
- **confidence**: `number` - Confidence level in the decision (0 to 100).
- **factors**: `RiskFactors` - Detailed risk factors included in the analysis.

## Return Values
On a successful request, the API returns a JSON object of type `FraudDetectionResult`, which includes the risk score, recommended decision, reasoning, confidence level, and analyzed risk factors.

## Example
### Request
```json
POST /api/fraud-detection
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "amount": 250.75,
  "currency": "USD",
  "location": {
    "lat": 34.052235,
    "lng": -118.243683,
    "country": "US",
    "city": "Los Angeles"
  },
  "timestamp": "2023-10-27T14:45:00Z",
  "paymentMethod": "CARD",
  "merchantId": "merchant_001",
  "deviceFingerprint": "fingerprint_abc123"
}
```

### Response
```json
{
  "riskScore": 75,
  "decision": "REVIEW",
  "reasons": [
    "High transaction velocity detected.",
    "Unusual location for user."
  ],
  "confidence": 85,
  "factors": {
    "velocityRisk": 30,
    "geographicRisk": 20,
    "behavioralRisk": 10,
    "amountRisk": 15
  }
}
``` 

This API empowers businesses to effectively mitigate fraud risks while handling transactions.