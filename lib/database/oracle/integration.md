# Generate Oracle Database Integration API

# Oracle Database Integration API Documentation

## Purpose
The Oracle Database Integration API provides functionality for managing connections to Oracle databases. This includes support for connection pooling, transaction management, and enterprise security compliance. It allows for creating and tracking database connections efficiently while ensuring secure and reliable interactions with Oracle databases.

## Usage
To integrate Oracle Database support in your application, utilize the provided API to manage connection configurations, monitor pool statuses, and ensure secure access to the Oracle database. The API allows you to create connection entries with necessary credentials and configurations, as well as to check the status of those connections.

## Parameters/Props

### `oracle_connections`
- **id**: UUID - Unique identifier for the connection.
- **name**: string - Unique name for the connection.
- **connection_string**: string - Connection string for Oracle database access.
- **username**: string - Username for database access.
- **password_hash**: string - Hashed password for enhanced security.
- **pool_config**: JSONB - Configuration settings for the connection pool.
  - `poolMin`: Minimum number of connections in the pool (default: 2).
  - `poolMax`: Maximum number of connections in the pool (default: 10).
  - `poolIncrement`: Increment of connections when needed (default: 1).
  - `poolTimeout`: Timeout in seconds for idle connections (default: 60).
  - `stmtCacheSize`: Size of the statement cache (default: 30).
  - `connectionTimeout`: Timeout in milliseconds for establishing connections (default: 30000).
- **security_config**: JSONB - Security configurations for the connection.
  - `sslMode`: SSL mode setting (default: "required").
  - `maxRetries`: Maximum number of retry attempts for failed connections (default: 3).
  - `retryDelay`: Delay between retries in milliseconds (default: 1000).
  - `isolationLevel`: Transaction isolation level (default: "READ_COMMITTED").
- **is_active**: boolean - Status of the connection (default: true).
- **environment**: string - Environment for the connection (default: "development").
- **created_at**: TIMESTAMPTZ - Timestamp for creation.
- **updated_at**: TIMESTAMPTZ - Timestamp for last update.
- **created_by**: UUID - Reference to the user who created the entry.
- **updated_by**: UUID - Reference to the user who last updated the entry.

### `oracle_pool_status`
- **id**: UUID - Unique identifier for the pool status record.
- **connection_id**: UUID - Reference to the associated connection.
- **pool_size**: integer - Total number of connections in the pool (default: 0).
- **connections_open**: integer - Number of currently open connections (default: 0).
- **connections_in_use**: integer - Number of connections currently in use (default: 0).
- **total_connections_created**: integer - Total number of connections created.

## Return Values
The API integrates the connection data into Oracle-specific databases and provides structured JSON responses containing connection status and error messages where applicable.

## Examples
```sql
-- Creating a new Oracle connection
INSERT INTO oracle_connections (name, connection_string, username, password_hash)
VALUES ('MainOracleDB', 'oracle://user:password@localhost:1521/ORCL', 'user', 'hashedPassword123');

-- Checking pool status for a connection
SELECT * FROM oracle_pool_status WHERE connection_id = 'YOUR_CONNECTION_ID';
``` 

This documentation serves as an overview of the Oracle Database Integration capabilities, providing necessary instructions for integration and usage.