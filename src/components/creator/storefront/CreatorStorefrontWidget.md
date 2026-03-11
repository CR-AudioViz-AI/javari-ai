# Build Creator Digital Storefront Widget

# Creator Digital Storefront Widget

## Purpose
The Creator Digital Storefront Widget is a React component designed to display and manage digital storefronts for creators. It provides an interactive interface for users to browse and purchase various digital products, including courses, templates, and services. The widget supports functionalities such as product filtering, cart management, and a customizable branding experience.

## Usage
To use the Creator Digital Storefront Widget, import the component into your React application and pass the necessary props for configuration and product listing:

```tsx
import CreatorStorefrontWidget from './src/components/creator/storefront/CreatorStorefrontWidget';

const App = () => {
  const brandingConfig = {
    primaryColor: '#ff6347',
    secondaryColor: '#4caf50',
    backgroundColor: '#f5f5f5',
    textColor: '#333333',
    fontFamily: 'Arial, sans-serif',
    borderRadius: '8px',
    logoUrl: 'path/to/logo.png',
    companyName: 'My Awesome Store',
    customCss: '.custom-class { margin: 10px; }'
  };

  const products = [
    {
      id: '1',
      title: 'React Course',
      description: 'Learn React from scratch.',
      price: 99.99,
      originalPrice: 149.99,
      category: 'course',
      image: 'path/to/image.png',
      tags: ['React', 'JavaScript'],
      rating: 4.5,
      reviewCount: 10,
      studentsCount: 100,
      duration: '10 hours',
      difficulty: 'beginner',
      features: ['Video Lectures', 'Quizzes'],
      isOnSale: true,
      inventory: 50,
      isDigital: true,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-05',
    }
    // Add more products as needed
  ];

  return <CreatorStorefrontWidget creatorId="creator123" brandingConfig={brandingConfig} products={products} />;
};
```

## Parameters/Props

### Required Props
- `creatorId` (string): Unique identifier for the creator.
- `brandingConfig` (BrandingConfig): Configuration for customizing the appearance of the storefront.
- `products` (Product[]): An array of product objects to be displayed in the storefront.

### BrandingConfig Interface
- `primaryColor` (string): Primary color for the widget.
- `secondaryColor` (string): Secondary color for the widget.
- `backgroundColor` (string): Background color of the widget.
- `textColor` (string): Text color within the widget.
- `fontFamily` (string): Font family used in the widget.
- `borderRadius` (string): Border radius for the widget elements.
- `logoUrl` (string, optional): URL of the logo image.
- `companyName` (string): Name of the company or creator.
- `customCss` (string, optional): Additional custom CSS styles.

### Product Interface
- `id` (string): Unique product identifier.
- `title` (string): Title of the product.
- `description` (string): Description of the product.
- `price` (number): Current price of the product.
- `originalPrice` (number, optional): Original price if on sale.
- `category` (string): Product category (e.g., course, digital-product).
- `image` (string): Product image URL.
- `tags` (string[]): Tags related to the product.
- `rating` (number): Average rating of the product.
- `reviewCount` (number): Number of reviews.
- `studentsCount` (number, optional): Number of students enrolled (if applicable).
- `duration` (string, optional): Duration of the course (if applicable).
- `difficulty` (string, optional): Difficulty level of the course.
- `features` (string[]): List of product features.
- `isOnSale` (boolean): Indicates whether the product is on sale.
- `inventory` (number): Available inventory.
- `isDigital` (boolean): Indicates if the product is digital.
- `createdAt` (string): Creation date of the product.
- `updatedAt` (string): Last updated date of the product.

## Return Values
The `CreatorStorefrontWidget` renders a storefront interface with functionalities for browsing products, adding to cart, and purchasing items directly through the widget.

## Example
Refer to the Usage section for a complete example of implementing the `CreatorStorefrontWidget`. Customize props as needed to reflect branding and product details accurately.