# Implement Payment Transaction History Database

```markdown
# Payment Transaction History Database Migration

## Purpose
This SQL migration script creates a comprehensive payment transaction history schema in the Supabase database. The schema includes audit trails and mechanisms for regulatory compliance, ensuring all payment transactions are tracked with detailed status updates.

## Usage
To use this migration, execute the SQL commands contained in the file `20241201_create_payment_transaction_history.sql`. This will set up the required database tables and types necessary for managing payment transactions within your application.

## Parameters/Props
The migration creates the following components:

- **Extensions**
  - `uuid-ossp`: Enables the generation of version 4 UUIDs.
  - `pg_trgm`: Provides support for trigram-based text searching.

- **Enums**
  - `payment_transaction_status`: Represents various states of a payment transaction (e.g., 'pending', 'completed', 'failed').
  - `payment_transaction_type`: Defines types of transactions such as 'payment', 'refund', or 'chargeback'.
  - `payment_method_type`: Lists payment method categories (e.g., 'credit_card', 'bank_transfer').
  - `dispute_status`: Tracks the stages of a dispute (e.g., 'initiated', 'accepted').
  - `settlement_status`: Indicates the status of settlement (e.g., 'pending', 'completed').

- **Tables**
  - `payment_processors`: Holds information about payment processors, including their unique ID, name, supported currencies, and operational configuration.
    - **Columns**: 
      - `id`: UUID (Primary Key)
      - `name`: Payment processor name
      - `code`: Unique processor code
      - `description`: Additional details
      - `supported_currencies`: Array of currencies supported
      - `supported_countries`: Array of countries supported
      - `configuration`: JSONB field for specific configurations
      - `is_active`: Status of the processor
      - `created_at`: Timestamp for creation
      - `updated_at`: Timestamp for updates
   
  - `payment_methods`: Captures details of payment methods used.
    - **Columns**:
      - `id`: UUID (Primary Key)
      - `org_id`: UUID for organization
      - `user_id`: UUID for the user associated
      - `processor_id`: UUID referencing `payment_processors`
      - `type`: Enum to classify the payment method
      - `name`: The name of the payment method
      - `last_four`: Last four digits of the payment card
      - `brand`: Brand of the payment card
      - `expiry_month`: Expiry month of the card
      - `expiry_year`: Expiry year of the card

## Return Values
This migration does not return values, but it will result in the successful creation of the tables and types within the Supabase database, enabling transaction management functionalities.

## Examples
To execute the SQL file, use the following command in the Supabase SQL editor or command-line interface:

```sql
\i supabase/migrations/20241201_create_payment_transaction_history.sql
```

After executing the migration, you will have access to the newly created schema, allowing you to insert, update, and query payment transaction data effectively.
```