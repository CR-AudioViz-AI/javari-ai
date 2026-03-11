# Build Oracle Database Integration API

# Oracle Database Integration API Documentation

## Purpose
The Oracle Database Integration API facilitates seamless connectivity and interaction with Oracle databases. It provides structures for managing database connections, queries, and their statuses, allowing developers to integrate Oracle database functionalities into applications effectively.

## Usage
This API is primarily used for creating and managing Oracle database connections and executing queries. It supports various connection types, including OCI and on-premise configurations. 

## Parameters/Props

### `oracle_connections` Table
- **id**: `UUID` - Unique identifier for the connection (default: generated UUID).
- **name**: `VARCHAR(255)` - Name of the connection (required).
- **description**: `TEXT` - Detailed description of the connection.
- **connection_type**: `oracle_connection_type` - Type of connection (`'oci'`, `'on_premise'`).
- **host**: `VARCHAR(255)` - Host IP or domain for the database.
- **port**: `INTEGER` - Port number for the database connection (default: `1521`).
- **service_name**: `VARCHAR(255)` - The service name for the Oracle instance.
- **sid**: `VARCHAR(255)` - The Oracle System Identifier.
- **username**: `VARCHAR(255)` - Username to access the database (required).
- **password_encrypted**: `TEXT` - Encrypted password for the database (required).
- **oci_config_profile**: `VARCHAR(255)` - OCI configuration profile.
- **oci_region**: `VARCHAR(100)` - OCI region for cloud connections.
- **oci_compartment_id**: `VARCHAR(255)` - OCI compartment ID.
- **oci_autonomous_database_id**: `VARCHAR(255)` - ID for autonomous databases in OCI.
- **pool_min**: `INTEGER` - Minimum number of connections in the pool (default: `1`).
- **pool_max**: `INTEGER` - Maximum number of connections in the pool (default: `10`).
- **pool_increment**: `INTEGER` - Increment for connection pool (default: `1`).
- **pool_timeout**: `INTEGER` - Timeout for connection requests in milliseconds (default: `60000`).
- **status**: `oracle_connection_status` - Current status of the connection (default: `'disconnected'`).
- **last_connected_at**: `TIMESTAMPTZ` - Timestamp of the last successful connection.
- **last_error**: `TEXT` - Last error encountered during connection.
- **health_check_interval**: `INTEGER` - Interval for health checks in seconds (default: `300`).
- **created_by**: `UUID` - User ID of the creator (references `auth.users`).
- **created_at**: `TIMESTAMPTZ` - Creation timestamp (default: `NOW()`).
- **updated_at**: `TIMESTAMPTZ` - Last update timestamp (default: `NOW()`).

### `oracle_queries` Table
- **id**: `UUID` - Unique identifier for the query (default: generated UUID).
- **connection_id**: `UUID` - The connection ID to which the query belongs (required, references `oracle_connections`).

## Return Values
Upon successful execution of queries or connection management operations, the API returns relevant status information, including connection state, error details if any, and the results of any executed queries.

## Examples
1. **Creating a Connection**
   ```sql
   INSERT INTO oracle_connections (name, description, connection_type, username, password_encrypted)
   VALUES ('My Oracle DB', 'Production Database', 'oci', 'db_user', 'encrypted_password');
   ```

2. **Executing a Query**
   ```sql
   INSERT INTO oracle_queries (connection_id)
   VALUES ('<your_connection_uuid>');
   ```

3. **Updating Connection Status**
   ```sql
   UPDATE oracle_connections
   SET status = 'connected', last_connected_at = NOW()
   WHERE id = '<your_connection_uuid>';
   ```

By utilizing the Oracle Database Integration API, developers can effectively handle Oracle database interactions, ensuring robust connectivity and management capabilities.