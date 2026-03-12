# Build SAP Enterprise Connector Module

# SAP Enterprise Connector Module Documentation

## Purpose
The SAP Enterprise Connector Module enables seamless integration with SAP ERP systems, facilitating real-time data synchronization, workflow automation, custom field mapping, and enterprise-grade security measures. It is designed for developers and system integrators looking to enhance their applications with SAP functionalities.

## Usage
To utilize the SAP Enterprise Connector, import the module into your project and create the necessary configuration objects to establish a connection with your SAP system. The module supports a variety of operations including importing and exporting data, as well as defining mapping and workflow rules for data processing.

## Parameters/Props

### SAPConfig
An object that defines the configuration parameters required to connect to an SAP system.

- **host**: `string` - The hostname or IP address of the SAP server.
- **port**: `number` - The port number for the SAP connection (typically 3200).
- **client**: `string` - The SAP client number.
- **systemNumber**: `string` - The system number assigned to the SAP instance.
- **username**: `string` - The username for SAP authentication.
- **password**: `string` - The password for SAP authentication.
- **language**: `string` (optional) - The language for the session (e.g., 'EN' for English).
- **gateway**: `object` (optional) - Contains `host` and `service` for the SAP gateway.
- **odata**: `object` (optional) - Contains `baseUrl` and `version` ('v2' or 'v4') for OData services.
- **security**: `object` - Security settings for the connection.
  - **enableSSL**: `boolean` - Whether to enable SSL connections.
  - **certificatePath**: `string` (optional) - Path to the SSL certificate.
  - **trustedCerts**: `string[]` (optional) - List of trusted certificates.
- **connection**: `object` - Connection settings.
  - **poolSize**: `number` - Number of concurrent connections in the pool.
  - **timeout**: `number` - Connection timeout in milliseconds.
  - **retryAttempts**: `number` - Number of retry attempts for failed connections.
  - **keepAlive**: `boolean` - Whether to enable TCP keep-alive.

### SAPConnection
An object representing an established connection to the SAP system.

- **id**: `string` - Unique identifier for the connection.
- **name**: `string` - A user-defined name for the connection.
- **config**: `SAPConfig` - The configuration settings used for the connection.
- **status**: `'active' | 'inactive' | 'error'` - Current status of the connection.
- **lastSync**: `Date | null` - Timestamp of the last successful data sync.
- **createdAt**: `Date` - Timestamp when the connection was created.
- **updatedAt**: `Date` - Timestamp when the connection configuration was last updated.

### SyncOperation
An object representing a synchronization operation.

- **id**: `string` - Unique identifier for the operation.
- **connectionId**: `string` - ID of the associated SAP connection.
- **operation**: `'import' | 'export' | 'bidirectional'` - Type of synchronization operation.
- **objectType**: `string` - Type of object being synchronized (e.g., 'Customer').
- **status**: `'pending' | 'running' | 'completed' | 'failed'` - Current status of the operation.
- **progress**: `number` - Progress percentage of the operation.
- **recordsProcessed**: `number` - Number of records processed so far.
- **recordsTotal**: `number` - Total number of records to be processed.
- **startedAt**: `Date` - Timestamp when the operation started.
- **completedAt**: `Date | undefined` - Timestamp when the operation completed (if applicable).
- **error**: `string | undefined` - Error message if the operation failed.

### FieldMapping
An object that defines the mappings between SAP fields and external fields.

- **id**: `string` - Unique identifier for the mapping.
- **connectionId**: `string` - ID of the associated SAP connection.
- **sapObject**: `string` - SAP object name (e.g., 'Customer').
- **externalObject**: `string` - External object name.
- **mappings**: `Record<string, { sapField: string, externalField: string, transformation?: string, required: boolean }>` - Mapping details for the fields.
- **createdAt**: `Date` - Timestamp when the mapping was created.
- **updatedAt**: `Date