# Build Dynamic Weather Pattern API

```markdown
# Dynamic Weather Pattern API Documentation

## Purpose
The Dynamic Weather Pattern API provides a mechanism to generate and retrieve dynamic weather patterns based on climatic models and environmental conditions. It allows users to access weather forecasts and understand the potential impacts of weather on activities.

## Usage
The API can be accessed via a route configured in the `src/app/api/craiverse/weather/route.ts` file. It integrates with Supabase for authentication and utilizes noise generation to create weather patterns.

## Parameters / Props
### WeatherPattern
A data structure representing the weather at a given time:
- `id` (string): Unique identifier for the weather pattern.
- `zoneId` (string): Identifier for the geographical zone.
- `temperature` (number): Current temperature in Celsius.
- `humidity` (number): Humidity percentage.
- `precipitation` (number): Amount of precipitation in mm.
- `windSpeed` (number): Wind speed in km/h.
- `windDirection` (number): Wind direction in degrees.
- `pressure` (number): Atmospheric pressure in hPa.
- `cloudCover` (number): Percentage of cloud cover.
- `visibility` (number): Visibility in kilometers.
- `weatherType` (WeatherType): Type of weather condition.
- `intensity` (number): Intensity of the weather effect.
- `timestamp` (Date): Time of weather pattern generation.
- `seasonalModifier` (number): Modifier based on the season.
- `climateZone` (ClimateZone): Climate classification of the zone.

### WeatherForecast
A structure for returning a forecast:
- `zoneId` (string): Identifier for the geographical zone.
- `predictions` (WeatherPattern[]): List of predicted weather patterns.
- `confidence` (number): Confidence level of the forecast.
- `trendAnalysis`: Object containing:
  - `temperatureTrend` (string): Forecast trend for temperature.
  - `precipitationTrend` (string): Forecast trend for precipitation.
  - `pressureTrend` (string): Forecast trend for pressure.

## Return Values
The API returns a `WeatherForecast` object which summarizes the predicted weather patterns along with their expected impacts.

## Examples
### Get Weather Forecast
```typescript
const response = await fetch('/api/craiverse/weather?zoneId=123');
const forecast = await response.json();
console.log(forecast);
```

### Weather Pattern Structure Example
```json
{
  "zoneId": "123",
  "predictions": [
    {
      "id": "abc",
      "zoneId": "123",
      "temperature": 24,
      "humidity": 85,
      "precipitation": 2,
      "windSpeed": 12,
      "windDirection": 270,
      "pressure": 1013,
      "cloudCover": 75,
      "visibility": 10,
      "weatherType": "CLOUDY",
      "intensity": 0.5,
      "timestamp": "2023-10-15T14:00:00Z",
      "seasonalModifier": 1.0,
      "climateZone": "TROPICAL"
    }
  ],
  "confidence": 0.9,
  "trendAnalysis": {
    "temperatureTrend": "stable",
    "precipitationTrend": "decreasing",
    "pressureTrend": "rising"
  }
}
```

This API facilitates real-time weather forecasting suited for varying geographical and environmental contexts, aiding users in decision-making based on weather patterns.
```