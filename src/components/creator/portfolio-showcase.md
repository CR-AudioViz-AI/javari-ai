# Create Creator Portfolio Showcase Component

```markdown
# Creator Portfolio Showcase Component

## Purpose
The Creator Portfolio Showcase Component provides a comprehensive interface to display a creator's portfolio, showcasing their media work, skills, testimonials, and collaborations. It enables users to navigate through their creative outputs in a visually appealing and interactive manner.

## Usage
To use the Creator Portfolio Showcase Component, import it into your React application and provide the necessary data props, including media items, skills, testimonials, and collaboration details.

## Parameters/Props

### Required Props

- `mediaItems`: `MediaItem[]`
  - An array of objects representing the media content (images, videos, audio) created by the creator.

- `skills`: `Skill[]`
  - An array of objects representing skills the creator possesses, including proficiency levels and experience.

- `testimonials`: `Testimonial[]`
  - An array of objects representing client testimonials for the creator's work.

- `collaborations`: `Collaboration[]`
  - An array of objects representing completed or ongoing collaborations with other clients or projects.

### MediaItem Interface
```tsx
interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnail?: string;
  title: string;
  description?: string;
  duration?: number;  // Optional, for video/audio types
  tags: string[];
  views: number;
  likes: number;
  created_at: string;  // Date in ISO format
}
```

### Skill Interface
```tsx
interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  years_experience: number;
  verified: boolean;
}
```

### Testimonial Interface
```tsx
interface Testimonial {
  id: string;
  client_name: string;
  client_avatar?: string;  // Optional
  client_company: string; 
  rating: number;  // Scale of 1-5
  content: string; 
  project_title: string; 
  created_at: string;  // Date in ISO format
}
```

### Collaboration Interface
```tsx
interface Collaboration {
  id: string;
  project_title: string;
  client_name: string;
  status: 'completed' | 'in_progress' | 'cancelled';
  start_date: string;  // Date in ISO format
  end_date?: string;  // Optional, only for completed projects
  budget: number; 
  rating?: number;  // Optional, client rating
}
```

## Return Values
The component returns a JSX element that displays the provided data in a structured format, including media showcases, skill listings, and testimonials, within an interactive carousel or tabbed interface.

## Examples

```tsx
import CreatorPortfolioShowcase from './src/components/creator/portfolio-showcase';

const portfolioData = {
  mediaItems: [/* Array of MediaItem objects */],
  skills: [/* Array of Skill objects */],
  testimonials: [/* Array of Testimonial objects */],
  collaborations: [/* Array of Collaboration objects */]
};

function App() {
  return (
    <div>
      <CreatorPortfolioShowcase 
        mediaItems={portfolioData.mediaItems} 
        skills={portfolioData.skills} 
        testimonials={portfolioData.testimonials} 
        collaborations={portfolioData.collaborations} 
      />
    </div>
  );
}
```

This example demonstrates a basic implementation of the Creator Portfolio Showcase Component with required data.
```