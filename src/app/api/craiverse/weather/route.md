# Build Advanced Weather Simulation API

# Advanced Weather Simulation API Documentation

## Purpose
The Advanced Weather Simulation API provides a robust framework for simulating and querying weather patterns across various regions and biomes. This API allows for the generation and manipulation of weather data over specified durations, as well as the retrieval of current and forecasted weather information.

## Usage
To use the API, requests must be made to the defined routes with appropriate parameters matching the specified schemas. The API supports both weather simulation creation and querying of weather conditions.

### Routes
- **POST /weather/simulate** - To create a simulated weather pattern.
- **GET /weather/query** - To query current or forecasted weather data.

## Parameters / Props

### Weather Simulation Parameters
- **regionId** (string, uuid): The unique identifier of the region where weather simulation occurs.
- **biomeType** (string): The type of biome for the simulation. Possible values include:
  - `desert`
  - `forest`
  - `mountain`
  - `coastal`
  - `plains`
  - `arctic`
  - `tropical`
- **duration** (number): The duration in days for the simulation. Minimum: 1, Maximum: 365.
- **seasonOverride** (string, optional): Overrides the season for the simulation. Possible values are `spring`, `summer`, `autumn`, `winter`.
- **intensityModifier** (number, default: 1.0): A modifier that adjusts the intensity of the weather patterns. Minimum: 0.1, Maximum: 3.0.
- **eventTriggers** (array of strings, optional): An array of events that may influence the simulation.

### Weather Query Parameters
- **regionId** (string, uuid): The unique identifier of the region for the query.
- **timeRange** (string, default: `current`): The range of time for which weather data is requested. Possible values are `current`, `hourly`, `daily`, `weekly`.
- **includeEffects** (boolean, default: `false`): Indicates whether to include effects of weather events in the response.
- **forecastDays** (number, optional): Number of days to include in the forecast. Minimum: 1, Maximum: 30.

## Return Values

### Weather Pattern Response
On successful simulation, a weather pattern object will be returned containing:
- id (string)
- regionId (string)
- timestamp (Date)
- temperature (number)
- humidity (number)
- precipitation (number)
- windSpeed (number)
- windDirection (number)
- pressure (number)
- cloudCover (number)
- visibility (number)
- uvIndex (number)
- season (string)
- weatherType (string)
- intensity (number)

### Weather Event Response
When querying weather data, the API may return weather event details, including:
- id (string)
- type (string)
- severity (number)
- duration (number)
- startTime (Date)
- endTime (Date)
- affectedRegions (array of strings)
- effects (array of WeatherEffect objects)

## Examples

### Simulating Weather
```json
POST /weather/simulate
{
  "regionId": "123e4567-e89b-12d3-a456-426614174000",
  "biomeType": "forest",
  "duration": 30,
  "seasonOverride": "summer",
  "intensityModifier": 1.5
}
```

### Querying Weather
```json
GET /weather/query
{
  "regionId": "123e4567-e89b-12d3-a456-426614174000",
  "timeRange": "daily",
  "includeEffects": true,
  "forecastDays": 7
}
```
This API facilitates dynamic weather simulations, providing an advanced tool for scenarios like gaming, environmental studies, and educational purposes.