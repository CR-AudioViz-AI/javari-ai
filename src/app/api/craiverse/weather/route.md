# Create CRAIverse Weather Simulation API

# CRAIverse Weather Simulation API Documentation

## Purpose
The CRAIverse Weather Simulation API allows developers to simulate and forecast weather patterns and events based on specified environmental parameters. It utilizes a combination of Supabase for data storage and Redis for caching, ensuring efficient retrieval and manipulation of weather-related data.

## Usage
This API supports creating, retrieving, and forecasting weather patterns and events using HTTP requests. The endpoints can be utilized to manage various weather attributes such as temperature, humidity, wind conditions, and weather events.

### Endpoints
1. **Create Weather Pattern**
2. **Create Weather Event**
3. **Forecast Weather**

## Parameters/Props

### Weather Pattern Parameters
- **environmentId**: `string` (UUID) - Unique identifier for the environment.
- **temperature**: `number` - Temperature in degrees Celsius (range: -50 to 60).
- **humidity**: `number` - Humidity percentage (range: 0 to 100).
- **windSpeed**: `number` - Wind speed in km/h (range: 0 to 200).
- **windDirection**: `number` - Wind direction in degrees (range: 0 to 360).
- **precipitation**: `number` - Precipitation percentage (range: 0 to 100).
- **pressure**: `number` - Atmospheric pressure in hPa (range: 900 to 1100).
- **visibility**: `number` - Visibility distance in kilometers (range: 0 to 50).
- **cloudCover**: `number` - Cloud cover percentage (range: 0 to 100).
- **season**: `string` (enum: spring, summer, autumn, winter) - Specifies the season.
- **climateZone**: `string` (enum: arctic, temperate, tropical, desert, mediterranean) - Specifies the climate zone.

### Weather Event Parameters
- **environmentId**: `string` (UUID) - Unique identifier for the environment.
- **eventType**: `string` (enum: storm, blizzard, heatwave, drought, fog, tornado) - Type of weather event.
- **intensity**: `number` - Intensity of the event on a scale of 1 to 10.
- **duration**: `number` - Duration of the event in hours (range: 1 to 24).

### Forecast Request Parameters
- **environmentId**: `string` (UUID) - Unique identifier for the environment.
- **hours**: `number` - Number of hours to forecast (optional, default is 24, max is 168).

## Return Values
- **Weather Pattern**: Object containing the parameters of the weather pattern saved, including a timestamp and optional conditions.
- **Weather Event**: Object containing details of the weather event with start and end times and its active status.
- **Forecast**: Predicted weather conditions for the specified environment and timeframe.

## Examples

### Create a Weather Pattern
```http
POST /api/craiverse/weather/pattern
Content-Type: application/json

{
  "environmentId": "123e4567-e89b-12d3-a456-426614174000",
  "temperature": 25,
  "humidity": 60,
  "windSpeed": 15,
  "windDirection": 180,
  "precipitation": 10,
  "pressure": 1013,
  "visibility": 10,
  "cloudCover": 50,
  "season": "summer",
  "climateZone": "temperate"
}
```

### Create a Weather Event
```http
POST /api/craiverse/weather/event
Content-Type: application/json

{
  "environmentId": "123e4567-e89b-12d3-a456-426614174000",
  "eventType": "storm",
  "intensity": 7,
  "duration": 12
}
```

### Forecast Weather
```http
GET /api/craiverse/weather/forecast?environmentId=123e4567-e89b-12d3-a456-426614174000&hours=24
```

This comprehensive API enables detailed simulations and forecasts of weather conditions, enhancing application functionality within the CRAIverse.