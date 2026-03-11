# Create Avatar Appearance Editor Component

# AvatarAppearanceEditor Component

## Purpose
The `AvatarAppearanceEditor` component allows users to customize the appearance of an avatar in a 3D environment. It provides a user-friendly interface to modify various attributes such as body, face, hair, clothing, and accessories.

## Usage
To use the `AvatarAppearanceEditor` component, you need to import it into your React application and render it within a parent component. Ensure that your project has the required dependencies installed, including `react-three-fiber`, `framer-motion`, and Zustand for state management.

```tsx
import AvatarAppearanceEditor from '@/components/avatar/AvatarAppearanceEditor';

const MyApp = () => {
  return (
    <div>
      <AvatarAppearanceEditor />
    </div>
  );
};
```

## Parameters/Props
The `AvatarAppearanceEditor` accepts the following optional props:

- `initialState` (optional): An object to set the initial appearance state of the avatar. It should conform to the `AvatarState` interface.

Example:
```tsx
const initialAvatarState = {
  body: {
    skinTone: 'light',
    height: 180,
    build: 1,
  },
  face: {
    eyeColor: 'blue',
    eyeShape: 'round',
    eyebrowStyle: 'arched',
    noseShape: 'straight',
    mouthShape: 'smile',
    expression: 'happy',
  },
  // additional states for hair, clothing, accessories...
};

<AvatarAppearanceEditor initialState={initialAvatarState} />
```

## Return Values
The component returns a fully interactive 3D avatar rendering along with a set of UI controls that allow users to customize different aspects of the avatar's appearance in real-time.

## Examples
Here is a simple example demonstrating how to render the `AvatarAppearanceEditor` with custom initial values:

```tsx
import React from 'react';
import AvatarAppearanceEditor from '@/components/avatar/AvatarAppearanceEditor';

const Example = () => {
  const initialAvatarState = {
    body: { skinTone: 'medium', height: 175, build: 2 },
    face: { eyeColor: 'green', eyeShape: 'almond', eyebrowStyle: 'straight', noseShape: 'pointy', mouthShape: 'frown', expression: 'neutral' },
    hair: { style: 'curly', color: 'black', length: 5 },
    clothing: { shirt: 't-shirt', pants: 'jeans', shoes: 'sneakers', colors: { shirt: 'red', pants: 'blue', shoes: 'white' } },
    accessories: { hat: 'cap', glasses: 'sunglasses', jewelry: 'necklace', colors: { hat: 'black', glasses: 'gold', jewelry: 'silver' } },
    animation: 'idle',
    name: 'AvatarName',
  };

  return <AvatarAppearanceEditor initialState={initialAvatarState} />;
};
```

In this example, we use the AvatarAppearanceEditor to create a customized avatar based on the specified initial state, allowing the user to modify its appearance through the provided interface.