# Create Procedural Content Generation API

# Procedural Content Generation API

## Purpose
The Procedural Content Generation API provides a structured way to generate various types of content, including quests, environments, storylines, and characters. It leverages machine learning models to tailor the generated content based on user-defined parameters and preferences.

## Usage
To use the Procedural Content Generation API, send a POST request to the endpoint `/api/generate`, including a JSON body that adheres to the defined schema. The API will return generated content based on the specified criteria.

## Parameters/Props
The request body must be a JSON object that conforms to the `GenerationRequestSchema`. The following properties are available:

- **contentType**: (string) One of 'quest', 'environment', 'storyline', or 'character'.
- **genre**: (string) Specify the genre from the following options: 'fantasy', 'scifi', 'horror', 'mystery', 'adventure', 'historical'.
- **context** (optional): 
  - **setting**: (string) Specific setting for the content.
  - **theme**: (string) Theme to guide content generation.
  - **difficulty**: (string) Set difficulty level ('easy', 'medium', 'hard').
  - **length**: (string) Content length ('short', 'medium', 'long').
  - **previousContent**: (array of strings) List of previous content for context.
- **userPreferences** (optional): 
  - **favoriteElements**: (array of strings) Elements that the user likes to include.
  - **avoidedTopics**: (array of strings) Topics to be avoided.
  - **complexityPreference**: (number) Complexity level from 1 to 10.
- **constraints** (optional):
  - **maxWords**: (number) Maximum word count for the generated content.
  - **requiredElements**: (array of strings) Elements that must be included.
  - **excludedElements**: (array of strings) Elements to exclude from the content.
  - **ageRating**: (string) Age rating ('G', 'PG', 'PG13', 'R').

## Return Values
The API returns a JSON object conforming to the `GenerationResponse` type, which includes:
- The generated content based on the specified parameters (quest, environment, storyline, or character).
- Metadata or additional information related to the generation process.

## Examples

### Example Request
```json
{
  "contentType": "quest",
  "genre": "fantasy",
  "context": {
    "setting": "enchanted forest",
    "theme": "courage",
    "difficulty": "medium",
    "length": "long"
  },
  "userPreferences": {
    "favoriteElements": ["dragons", "magic"],
    "avoidedTopics": ["dark magic"],
    "complexityPreference": 7
  },
  "constraints": {
    "maxWords": 500,
    "requiredElements": ["questgiver"],
    "excludedElements": ["time travel"],
    "ageRating": "PG13"
  }
}
```

### Example Response
```json
{
  "content": {
    "title": "The Dragon's Challenge",
    "description": "In the depths of the enchanted forest, a noble quest awaits heroes brave enough to face the dragon guarding the lost treasure."
  },
  "metadata": {
    "generationTime": "2 seconds",
    "contentType": "quest"
  }
}
``` 

This documentation outlines the procedural content generation API's purpose, how to use it, key parameters, potential return values, and example usage for clarity in implementation.