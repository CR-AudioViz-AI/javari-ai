# Build Enterprise Document Intelligence Engine

# Enterprise Document Intelligence Engine API

## Purpose
The Enterprise Document Intelligence Engine API provides functionality to analyze documents, extracting insights, compliance information, and performing risk assessments. It uses OpenAI's language models and stores data using Supabase.

## Usage
This API endpoint is designed to process document-related requests, enabling applications to extract critical information and assess compliance and risk from various document types.

### Endpoint
- **URL**: `/api/enterprise/document-intelligence`
- **Method**: `POST`

## Parameters / Props
The request body should conform to the following schema:

```json
{
  "document_id": "string",
  "content": "string (optional)",
  "file_url": "string (optional, url)",
  "document_type": "enum (optional)",
  "metadata": "object (optional)",
  "compliance_rules": ["string] (optional)",
  "extract_entities": "boolean (default: true)",
  "generate_summary": "boolean (default: true)",
  "risk_assessment": "boolean (default: true)",
  "knowledge_graph": "boolean (default: false)"
}
```

### Required
- `document_id`: Unique identifier for the document.
- **One of the following**:
  - `content`: The text content of the document.
  - `file_url`: A URL pointing to the document file.

### Optional
- `document_type`: Type of document (`contract`, `report`, `communication`, `policy`, `invoice`, `other`).
- `metadata`: Additional metadata in key-value pairs.
- `compliance_rules`: List of compliance rules to evaluate against.
- `extract_entities`: Flag to extract key entities (default: true).
- `generate_summary`: Flag to generate a summary (default: true).
- `risk_assessment`: Flag to perform risk assessment (default: true).
- `knowledge_graph`: Flag to generate a knowledge graph (default: false).

## Return Values
Upon success, the API responds with a JSON object containing:

```json
{
  "id": "string",
  "document_id": "string",
  "document_type": "string",
  "content_summary": "string",
  "key_entities": [
    {
      "type": "string",
      "value": "string",
      "confidence": "number",
      "context": "string",
      "position": { "start": "number", "end": "number" }
    }
  ],
  "compliance_status": {
    "overall_status": "string",
    "rule_violations": [
      {
        "rule_id": "string",
        "rule_name": "string",
        "severity": "string"
      }
    ],
    "recommendations": ["string"],
    "score": "number"
  },
  "risk_assessment": "object",
  "insights": ["string"],
  "confidence_score": "number",
  "processing_time_ms": "number",
  "knowledge_graph_nodes": "array (optional)",
  "created_at": "string"
}
```

## Examples

### Example Request
```json
POST /api/enterprise/document-intelligence
{
  "document_id": "12345",
  "content": "This is an example document.",
  "document_type": "report",
  "compliance_rules": ["rule1", "rule2"],
  "extract_entities": true,
  "generate_summary": true
}
```

### Example Response
```json
{
  "id": "abcd1234",
  "document_id": "12345",
  "document_type": "report",
  "content_summary": "Summary of the example document.",
  "key_entities": [
    {
      "type": "Person",
      "value": "John Doe",
      "confidence": 0.95,
      "context": "example context",
      "position": { "start": 0, "end": 8 }
    }
  ],
  "compliance_status": {
    "overall_status": "compliant",
    "rule_violations": [],
    "recommendations": [],
    "score": 1.0
  },
  "risk_assessment": {},
  "insights": ["Insight 1", "Insight 2"],
  "confidence_score": 0.80,
  "processing_time_ms": 200,
  "created_at": "2023-10-01T12:00:00Z"
}
```

This API enables comprehensive analysis and provides critical information on documents for businesses and enterprises.