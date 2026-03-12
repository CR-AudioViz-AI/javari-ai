# Deploy Edge Computing Optimization Service

# Edge Computing Optimization Service Migration

## Purpose

The Edge Computing Optimization Service migration script sets up the necessary database structure for managing edge computing nodes, their status, workloads, and capabilities. This service allows efficient scheduling and optimization of resources at the edge of a network.

## Usage

This SQL migration should be executed within a PostgreSQL database that uses Supabase for managing database migrations. It initializes the required extensions, custom types, and creates the edge_nodes table to facilitate tracking and managing edge computing resources.

## Parameters/Props

### Extensions
- **uuid-ossp**: Enables UUID generation for unique identifiers.
- **postgis**: Provides geographic data capabilities.
- **pg_stat_statements**: Allows monitoring of execution statistics.

### Custom Types
- **edge_node_status**: Enum for the status of edge nodes. Possible values are:
  - `active`
  - `maintenance`
  - `overloaded`
  - `offline`

- **workload_status**: Enum for the status of workloads. Possible values include:
  - `pending`
  - `deploying`
  - `running`
  - `migrating`
  - `stopped`
  - `failed`

- **migration_status**: Enum for migration phases. Possible values are:
  - `initiated`
  - `in_progress`
  - `completed`
  - `failed`
  - `rolled_back`

- **capability_type**: Enum representing the capabilities of edge nodes:
  - `gpu`
  - `tpu`
  - `cpu_intensive`
  - `memory_intensive`
  - `storage_intensive`
  - `network_intensive`

### edge_nodes Table Structure
- **id**: UUID for the edge node (Primary Key).
- **name**: Name of the edge node (String).
- **region**: Geographic region (String).
- **zone**: Specific zone within the region (String).
- **location**: Geographic location represented as a POINT (Geometric type).
- **ip_address**: IP address of the edge node (INET).
- **port**: Port for service access (Integer, default: 8080).
- **status**: Status using edge_node_status (Enum, default: 'active').
- **max_workloads**: Maximum workloads the node can handle (Integer, default: 10).
- **current_workloads**: Currently assigned workloads (Integer, default: 0).
- **cpu_cores**: Number of CPU cores (Integer).
- **memory_gb**: Memory capacity in GB (Integer).
- **storage_gb**: Storage capacity in GB (Integer).
- **network_bandwidth_mbps**: Network bandwidth in Mbps (Integer).
- **gpu_count**: Number of GPUs (Integer, default: 0).
- **gpu_model**: Model of the GPU (String).
- **tpu_count**: Number of TPUs (Integer, default: 0).
- **tpu_model**: Model of the TPU (String).
- **cost_per_hour**: Cost for using the node per hour (Decimal).
- **availability_zone**: Availability zone for the node (String).
- **provider**: Cloud provider hosting the edge node (String).
- **metadata**: Additional metadata (JSONB, default: '{}').
- **health_check_url**: URL for health checks (String).

## Return Values

This migration does not return any values directly. Upon successful execution, it establishes the database schema necessary for managing edge computing nodes.

## Example

To apply this migration, run the following command in your Supabase migration environment:

```bash
supabase db push
```

Ensure your database connection is correctly configured in your Supabase setup before executing the command.