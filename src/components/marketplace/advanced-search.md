# Build Marketplace Advanced Search Interface

```markdown
# Marketplace Advanced Search Interface

## Purpose
The `AdvancedSearch` component is designed to facilitate complex searches within a marketplace application. It allows users to filter results based on various criteria, including keywords, categories, capabilities, price ranges, ratings, and sorting options, providing a user-friendly way to discover products or services.

## Usage
To use the `AdvancedSearch` component, import it within your JSX and include it in your render method. The component handles its own state and form validation, leveraging the `react-hook-form` library and `zod` for schema validation.

### Installation
Ensure you have the required libraries installed:
```bash
npm install react-hook-form zod lucide-react
```

### Example
```tsx
import AdvancedSearch from '@/components/marketplace/advanced-search';

const MarketplacePage = () => (
  <div>
    <h1>Marketplace</h1>
    <AdvancedSearch />
    {/* Additional marketplace listings */}
  </div>
);
```

## Parameters/Props
The `AdvancedSearch` component does not take any external props as it manages its internal state and data fetching. It integrates predefined UI components and validation schemas.

### Validation Schema
The search form is validated using a schema defined by `zod`. The keys and their types in the form include:
- `query` (string, optional): The search text entered by the user.
- `categories` (array of strings, optional): Selected categories for filtering.
- `capabilities` (array of strings, optional): Capabilities to filter the results.
- `priceRange` (array of numbers, length 2, optional): Minimum and maximum prices.
- `ratingRange` (array of numbers, length 2, optional): Minimum and maximum ratings.
- `performanceMin` (number, optional): Minimum performance threshold.
- `tags` (array of strings, optional): Tags for advanced searching.
- `sortBy` (enum, optional): Criteria for sorting (relevance, rating, price, performance, popularity).
- `sortOrder` (enum, optional): Sort order (asc or desc).

## Return Values
The `AdvancedSearch` component does not return values directly, as it primarily operates as a UI element to submit search queries. Upon form submission, data is processed according to the defined schema and can be used to fetch relevant marketplace listings.

## Features
- Real-time form validation using `zod`.
- User-friendly interface with various filtering options.
- Integration with multiple UI components integrated from the `ui` component library.

## Additional Information
- Ensure your component tree is wrapped with any necessary providers (e.g., a context provider if needed).
- Adjust the UI components (like buttons, inputs) as per your design requirements.

This documentation provides a concise overview of how to implement and utilize the `AdvancedSearch` component. For more details on individual UI components, refer to their respective documentation.
```