# Deploy CRAIverse Asset Streaming Service

# CRAIverse Asset Streaming Service Documentation

## Purpose
The CRAIverse Asset Streaming Service provides a structured framework for managing the streaming of various digital assets, such as 3D models, textures, audio files, and more. It utilizes different streaming protocols and adapts quality levels based on the user's bandwidth metrics.

## Usage
This service is designed to be integrated into applications where efficient asset streaming is required. It allows for managing streaming sessions, monitoring bandwidth, and handling different types of assets seamlessly.

## Parameters/Props

### Enums
- **AssetType**: Enum defining supported asset types.
  - `MODEL_3D`
  - `TEXTURE`
  - `AUDIO`
  - `VIDEO`
  - `ANIMATION`
  - `MATERIAL`
  - `SHADER`
  - `ENVIRONMENT`

- **QualityLevel**: Enum for adaptive streaming quality.
  - `LOW`
  - `MEDIUM`
  - `HIGH`
  - `ULTRA`

- **StreamingProtocol**: Enum for supported streaming protocols.
  - `HTTP`
  - `WEBRTC`
  - `WEBSOCKET`
  - `PROGRESSIVE`

### Interfaces
- **AssetMetadata**: Represents the metadata of an asset.
  - `id: string`
  - `type: AssetType`
  - `name: string`
  - `url: string`
  - `cdnUrls: Record<string, string>`
  - `size: number`
  - `compressionRatio: number`
  - `qualityLevels: QualityLevel[]`
  - `dependencies: string[]`
  - `tags: string[]`
  - `version: string`
  - `checksums: Record<QualityLevel, string>`
  - `createdAt: Date`
  - `updatedAt: Date`

- **BandwidthMetrics**: Captures bandwidth monitoring data.
  - `downloadSpeed: number` (Mbps)
  - `uploadSpeed: number` (Mbps)
  - `latency: number` (ms)
  - `packetLoss: number` (percentage)
  - `timestamp: Date`

- **StreamingSession**: Configuration for a streaming session.
  - `id: string`
  - `clientId: string`
  - `bandwidth: BandwidthMetrics`
  - `qualityLevel: QualityLevel`
  - `protocol: StreamingProtocol`
  - `preloadQueue: string[]`
  - `activeTasks: Map<string, StreamingTask>`
  - `startTime: Date`

- **StreamingTask**: Represents individual streaming tasks.
  - `assetId: string`
  - `priority: number`
  - `qualityLevel: QualityLevel`
  - `progress: number`
  - `startTime: Date`
  - `estimatedCompletion: Date`
  - `retryCount: number`

## Return Values
The service can return various outputs such as:
- Success or error messages upon streaming asset requests.
- Bandwidth metrics for monitoring.
- Details of the initial configuration for streaming sessions and tasks.

## Examples

### Creating a Streaming Session
```typescript
const session: StreamingSession = {
  id: "session123",
  clientId: "clientABC",
  bandwidth: {
    downloadSpeed: 10,
    uploadSpeed: 5,
    latency: 30,
    packetLoss: 0,
    timestamp: new Date(),
  },
  qualityLevel: QualityLevel.HIGH,
  protocol: StreamingProtocol.WEBSOCKET,
  preloadQueue: [],
  activeTasks: new Map(),
  startTime: new Date(),
};
```

### Defining an Asset
```typescript
const asset: AssetMetadata = {
  id: "asset001",
  type: AssetType.MODEL_3D,
  name: "Example Model",
  url: "https://example.com/assets/model.obj",
  cdnUrls: { "low": "https://cdn.example.com/assets/model_low.obj" },
  size: 2048,
  compressionRatio: 0.5,
  qualityLevels: [QualityLevel.LOW, QualityLevel.MEDIUM, QualityLevel.HIGH],
  dependencies: [],
  tags: ["3D", "Model"],
  version: "1.0.0",
  checksums: {
    [QualityLevel.LOW]: "checksum_low",
    [QualityLevel.HIGH]: "checksum_high",
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};
```