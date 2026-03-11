# Implement Real-Time Currency Conversion Service

# Real-Time Currency Conversion Service Documentation

## Purpose
The Real-Time Currency Conversion Service provides a comprehensive system for converting currencies using multiple sources for exchange rates. It allows users to access a flexibly organized database including metadata on various currencies, currency pairs for conversion, and sources for obtaining exchange rates.

## Usage
This SQL migration file sets up the necessary tables and configurations for the currency conversion system. Run this migration using Supabase's migration tools to establish the database schema.

## Parameters/Props
### Tables Created

#### `currency_metadata`
- **id**: UUID (Primary Key)
- **code**: VARCHAR(10) (Unique currency code)
- **name**: VARCHAR(100) (Name of the currency)
- **symbol**: VARCHAR(10) (Currency symbol)
- **type**: VARCHAR(20) (Type of currency: 'fiat', 'crypto', 'stablecoin', 'commodity')
- **decimal_places**: INTEGER (Number of decimal places for amounts; default is 2)
- **is_active**: BOOLEAN (Flag indicating if the currency is active; default is true)
- **metadata**: JSONB (Additional metadata)
- **created_at**: TIMESTAMPTZ (Timestamp of creation; default is now)
- **updated_at**: TIMESTAMPTZ (Timestamp of last update; default is now)

#### `currency_pairs`
- **id**: UUID (Primary Key)
- **base_currency**: VARCHAR(10) (References `currency_metadata.code`)
- **quote_currency**: VARCHAR(10) (References `currency_metadata.code`)
- **is_active**: BOOLEAN (Flag indicating if the pair is active; default is true)
- **min_amount**: DECIMAL(20,8) (Minimum amount for conversion)
- **max_amount**: DECIMAL(20,8) (Maximum amount for conversion)
- **fee_percentage**: DECIMAL(5,4) (Fee on the conversion; default is 0)
- **metadata**: JSONB (Additional metadata)
- **created_at**: TIMESTAMPTZ (Timestamp of creation; default is now)
- **updated_at**: TIMESTAMPTZ (Timestamp of last update; default is now)
- **UNIQUE(base_currency, quote_currency)**: Ensures pairing uniqueness.

#### `exchange_rate_sources`
- **id**: UUID (Primary Key)
- **name**: VARCHAR(100) (Unique name of the source)
- **type**: VARCHAR(50) (Source type: 'api', 'websocket', 'manual', 'aggregator')
- **base_url**: VARCHAR(500) (Base URL of the source for API calls)
- **api_key_required**: BOOLEAN (Indicates if an API key is needed; default is false)
- **rate_limit_per_hour**: INTEGER (Limit on the number of API calls)
- **reliability_score**: DECIMAL(3,2) (Score assessing reliability; default is 1.00)
- **priority**: INTEGER (Priority for source selection; default is 1)
- **is_active**: BOOLEAN (Flag indicating if the source is active; default is true)
- **supported_currencies**: TEXT[] (List of currencies supported by this source)
- **configuration**: JSONB (Configuration settings for the source)

## Return Values
The SQL migration does not return values but creates a structured database to manage currency conversion operations. It facilitates future API integrations for real-time conversion requests and ensures data integrity and ease of use.

## Examples
To implement this migration, execute the following command in your Supabase SQL environment:

```sql
-- Execute Migration
\i supabase/migrations/20240101000012_create_currency_conversion_service.sql
```

This setup allows you to then add currencies, pair them, and configure exchange rate sources as required for your application.