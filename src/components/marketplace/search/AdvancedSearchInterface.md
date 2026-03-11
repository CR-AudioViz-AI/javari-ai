# Build Advanced Marketplace Search Interface

# AdvancedSearchInterface Documentation

## Purpose
The `AdvancedSearchInterface` component provides a sophisticated search interface for a marketplace application. It allows users to filter and search for marketplace items using various criteria such as categories, price range, ratings, and tags.

## Usage
To use the `AdvancedSearchInterface`, simply import it into your React component and render it while passing any necessary props. This component is meant to be a part of a larger marketplace application where products are displayed based on user-defined criteria.

```tsx
import AdvancedSearchInterface from './src/components/marketplace/search/AdvancedSearchInterface';

const SomeComponent = () => {
  const handleSearchResults = (results) => {
    console.log(results);
  };

  return (
    <AdvancedSearchInterface onSearchResults={handleSearchResults} className="my-custom-class" />
  );
};
```

## Parameters/Props
| Prop                  | Type                                   | Default       | Description                                                                 |
|-----------------------|----------------------------------------|---------------|-----------------------------------------------------------------------------|
| `className`           | `string`                               | `undefined`   | Optional class name to style the component.                                 |
| `onSearchResults`     | `(results: MarketplaceItem[]) => void`| `undefined`   | Callback function to handle the results of the search.                    |

### MarketplaceItem Interface
The `MarketplaceItem` interface defines the structure of items being searched, including properties like:
- `id`: Unique identifier for the item.
- `title`: Name of the item.
- `description`: Brief description of the item.
- `price`: Price of the item.
- `rating`: Average user rating.
- `review_count`: Number of reviews.
- `category_id`: ID of the category.
- `category_name`: Name of the category.
- `subcategory_name`: Optional subcategory name.
- `image_url`: URL of the item's image.
- `seller_name`: Name of the seller.
- `tags`: Array of tags associated with the item.
- `created_at`: Date the item was added.

### SearchFilters Interface
Filters used for refining search queries:
- `query`: User search term.
- `categories`: Array of selected category IDs.
- `priceRange`: Array defining minimum and maximum price.
- `minRating`: Minimum average rating for displayed items.
- `sortBy`: Defines sorting method among 'relevance', 'price_asc', 'price_desc', 'rating', or 'newest'.
- `tags`: Array of selected tags.

## Return Values
The `AdvancedSearchInterface` does not return any values directly. Instead, it triggers the `onSearchResults` callback with the filtered search results whenever a search is performed.

## Examples
```tsx
const MyMarketplace = () => {
  const handleSearchResults = (results: MarketplaceItem[]) => {
    // Process search results (e.g., update state, display components)
    console.log('Search results:', results);
  };

  return (
    <div>
      <h1>Find Your Next Favorite Item</h1>
      <AdvancedSearchInterface 
        className="search-interface"
        onSearchResults={handleSearchResults} 
      />
      {/* Here you can render search results based on state */}
    </div>
  );
};
```

In the example above, whenever a search is performed in the `AdvancedSearchInterface`, the `handleSearchResults` function is invoked with the search results, allowing the parent component to process or display them accordingly.