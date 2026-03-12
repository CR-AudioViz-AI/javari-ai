# Implement Real-Time FX Optimization API

```markdown
# Real-Time FX Optimization API

## Purpose
The Real-Time FX Optimization API is designed to optimize foreign exchange transactions by analyzing different liquidity providers and transactional parameters. It aims to provide users with the best execution routes considering various risk management strategies and compliance requirements.

## Usage
This API can be integrated into financial applications that require real-time forex transaction optimization based on the defined parameters. It prioritizes efficiency, compliance, and cost-effectiveness.

### Endpoint
- `POST /api/fx/optimize`

## Parameters/Props
The API accepts a JSON request body that adheres to the following schema using the Zod validation library:

- **currencyPair** (string): The forex pair, formatted as `XXX/YYY` (e.g., "EUR/USD").
- **amount** (number): The transaction amount, must be positive and less than or equal to 100 million.
- **maxSlippage** (number): Maximum acceptable slippage expressed as a percentage (0 to 5%).
- **urgency** (enum): Transaction urgency, can be `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- **jurisdiction** (string): The jurisdiction code (2-3 characters).
- **hedgingPreference** (enum): Hedging strategy choice: `NONE`, `PARTIAL`, or `FULL`.
- **clientId** (string): A UUID representing the client requesting the optimization.
- **executionWindow** (number, optional): Time window for executing the transaction (in seconds, 1 to 3600).

## Return Values
The API responds with a JSON object containing the optimization results:

- **optimalRoute**: Selected execution route providing details about:
  - **providerId** (string): ID of the liquidity provider.
  - **allocation** (number): Amount allocated to this provider.
  - **expectedRate** (number): Rate expected for the forex pair transaction.
  - **estimatedLatency** (number): Estimated time delay in milliseconds.
  
- **estimatedCost** (number): Total estimated cost for the transaction.
- **estimatedSlippage** (number): Calculated slippage for the transaction.
- **riskScore** (number): An assessment score of the risk involved.
- **complianceStatus** (string): Status regarding regulatory compliance.
- **hedgingStrategy** (HedgingStrategy or null): Details of the hedging strategy, if applicable.
- **executionInstructions** (array of ExecutionInstruction): Instructions for executing the transaction, detailing provider ID, amount, rate, and compliance flags.

## Examples

### Request
```json
{
  "currencyPair": "EUR/USD",
  "amount": 5000000,
  "maxSlippage": 0.02,
  "urgency": "HIGH",
  "jurisdiction": "US",
  "hedgingPreference": "PARTIAL",
  "clientId": "123e4567-e89b-12d3-a456-426614174000",
  "executionWindow": 300
}
```

### Response
```json
{
  "optimalRoute": {
    "providerId": "provider123",
    "allocation": 5000000,
    "expectedRate": 1.1834,
    "estimatedLatency": 35
  },
  "estimatedCost": 5917000,
  "estimatedSlippage": 0.0005,
  "riskScore": 2,
  "complianceStatus": "COMPLIANT",
  "hedgingStrategy": {
    "type": "PARTIAL",
    "instruments": ["Futures Contract"],
    "ratio": 0.5,
    "cost": 300
  },
  "executionInstructions": [
    {
      "providerId": "provider123",
      "amount": 5000000,
      "rate": 1.1834,
      "timestamp": 1633072800000,
      "complianceFlags": []
    }
  ]
}
```
```