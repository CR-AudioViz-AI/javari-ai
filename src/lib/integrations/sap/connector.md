# Implement SAP Business Suite Connector API

# SAP Business Suite Connector API Documentation

## Purpose
The SAP Business Suite Connector API facilitates integration with SAP systems by providing a standardized method for interacting with various SAP data models. This API primarily targets operations related to ERP data, financial transactions, and supply chain management.

## Usage
The API functions are to be used within a Node.js environment, specifically with the Next.js framework. This API relies on client authentication, which is managed through configurations defined in `SAPAuthConfig`.

### Example Usage:
To utilize the ERP module to post a document:

```typescript
import { ERPModule } from './src/lib/integrations/sap/connector';

const erp: ERPModule = // ...initialize your ERP module instance

const documentData = {
  companyCode: '1000',
  fiscalYear: '2023',
  amount: 1500.00,
  postingDate: '2023-10-01'
};

erp.postDocument(documentData)
   .then(response => console.log('Document Posted:', response))
   .catch(error => console.error('Error posting document:', error));
```

## Parameters/Props

### SAP Authentication Configuration
- **clientId**: SAP client identifier (string, required)
- **clientSecret**: SAP client secret (string, required)
- **tokenEndpoint**: URL to obtain access tokens (string, required)
- **baseUrl**: Base URL for SAP API calls (string, required)
- **scope**: Optional scopes for token (string, optional)

### ERP Data Model
- **companyCode**: Company code for the transaction (string, required)
- **fiscalYear**: Fiscal year of the transaction (string, required)
- **documentNumber**: Optional document reference (string, optional)
- **postingDate**: Posting date of the transaction (string, optional)
- **amount**: Transaction amount (number, optional)

### Financials Data Model
- **costCenter**: Identifier for the cost center (string, required)
- **profitCenter**: Optional identifier for the profit center (string, optional)
- **accountingDocument**: Optional accounting document reference (string, optional)
- **period**: Period of the financial record (number, required)
- **year**: Year of the financial record (number, required)

### Supply Chain Data Model
- **materialNumber**: Identifier for the material (string, required)
- **plant**: Identifier for the plant (string, required)
- **storageLocation**: Optional storage location identifier (string, optional)
- **quantity**: Quantity of the material (number, optional)
- **unitOfMeasure**: Unit of measurement for the quantity (string, optional)

### Webhook Event Model
- **eventType**: Type of the event (string, values: 'ERP_DOCUMENT_POSTED', 'INVENTORY_CHANGED', 'COST_CENTER_UPDATED', required)
- **payload**: Data related to the event (record, required)
- **timestamp**: Time of the event (string, required)
- **source**: Source of the event (string, required)

## Return Values
- **Promise<any>**: Each method returns a promise that resolves to the response from the SAP API or rejects with an error.

## Examples
### Posting a Document
```typescript
const response = await erp.postDocument({
  companyCode: '1000',
  fiscalYear: '2023',
  amount: 1000.00
});
console.log(response);
```

### Fetching Cost Centers
```typescript
const costCenters = await financials.getCostCenters({
  costCenter: 'CC100',
  period: 10,
  year: 2023
});
console.log(costCenters);
```

This documentation provides a concise reference to utilize the SAP Business Suite Connector API effectively. Please ensure all parameters conform to their respective data types and schemas as defined.