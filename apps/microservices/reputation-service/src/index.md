# Deploy Community Reputation Calculation Service

# Community Reputation Calculation Service

## Purpose
The Community Reputation Calculation Service is a standalone microservice responsible for computing user reputation scores based on various community metrics, including contributions, peer reviews, and historical activity. It provides features such as transparent scoring, appeal processes for disputed scores, and real-time reputation updates.

## Usage
To deploy the Community Reputation Calculation Service, ensure the following prerequisites are in place:
- Node.js (version 12 or higher)
- NPM or Yarn for package management
- A running database and Redis instance

### Startup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   ```
2. Navigate to the service directory:
   ```bash
   cd apps/microservices/reputation-service
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file in the root directory to define configuration settings.
5. Start the service:
   ```bash
   npm start
   ```

## Parameters / Props
The service accepts configurable parameters via a `.env` file:

- **Service Configuration**:
  - `PORT`: Port number for the server (default: 3000)
  - `ENVIRONMENT`: Application environment (e.g., `development`, `production`)
  - `DATABASE_URL`: URL for database connection
  - `MAX_CONNECTIONS`: Maximum database connections available
  - `REDIS_URL`: URL for Redis instance
  - `REDIS_TTL`: Time-to-live setting for cached entries
  - `CONTRIBUTION_WEIGHT`: Weight assigned to user contributions in score calculations
  - `PEER_REVIEW_WEIGHT`: Weight assigned to peer reviews in score calculations
  - `COMMUNITY_IMPACT_WEIGHT`: Weight assigned to community impact metrics
  - `DECAY_FACTOR`: Factor affecting the decay of older scores
  - `MAX_APPEALS_PER_USER`: Maximum number of appeals allowed per user
  - `APPEAL_WINDOW_DAYS`: Time window allowed for appeals in days

## Return Values
The service responds to requests with JSON objects that include:

- **Health Check Response**:
  - `status`: Indicates if the service is "healthy" or "unhealthy"
  - `timestamp`: Timestamp of the response

Example Health Check Response:
```json
{
  "status": "healthy",
  "timestamp": "2023-10-03T12:00:00Z"
}
```

## Examples

**Get Reputation Score**
```http
GET /api/reputation/:userId
```
**Response:**
```json
{
  "userId": "12345",
  "reputationScore": 82.5
}
```

**Submit an Appeal**
```http
POST /api/appeals
```
**Request Body:**
```json
{
  "userId": "12345",
  "reason": "Disputed score calculated on 2023-10-01"
}
```
**Response:**
```json
{
  "status": "success",
  "message": "Appeal submitted successfully."
}
```

## Conclusion
This service provides a comprehensive framework for managing community reputations through configurable scoring algorithms, facilitating transparent operations and user interaction.