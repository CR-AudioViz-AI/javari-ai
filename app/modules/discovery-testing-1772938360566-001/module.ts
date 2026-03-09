To execute the task of adding a test suite to your React/Next.js project, follow these steps:

### Step 1: Install Testing Libraries

First, you need to install Jest and React Testing Library. Open your terminal and run the following command:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

If you are using TypeScript, you may also want to install the types for Jest:

```bash
npm install --save-dev @types/jest
```

### Step 2: Configure Jest

Create a configuration file for Jest. You can create a file named `jest.config.js` in the root of your project with the following content:

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  moduleNameMapper: {
    '\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
};
```

### Step 3: Create a Setup File

Create a file named `setupTests.js` in the root of your project. This file will allow you to set up any global configurations or imports for your tests. Add the following line to it:

```javascript
import '@testing-library/jest-dom/extend-expect';
```

### Step 4: Create Your First Test

Create a directory for your tests, usually named `__tests__` or `tests`. Inside this directory, create a test file, for example, `MyComponent.test.js`. Here’s a simple example of how to test a React component:

```javascript
import React from 'react';
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent'; // Adjust the import according to your file structure

test('renders MyComponent with correct text', () => {
  render(<MyComponent />);
  const linkElement = screen.getByText(/some text/i);
  expect(linkElement).toBeInTheDocument();
});
```

### Step 5: Update Package.json Scripts

Add a test script to your `package.json` to easily run your tests:

```json
"scripts": {
  "test": "jest"
}
```

### Step 6: Run Your Tests

Now you can run your tests using the following command:

```bash
npm test
```

### Step 7: Add More Tests

Continue to add more unit and integration tests for your components and pages to ensure that your application is well-tested and to prevent regressions.

### Step 8: Continuous Integration (Optional)

Consider integrating your tests into a CI/CD pipeline to ensure that tests are run automatically on every push or pull request.

### Conclusion

By following these steps, you will have successfully added a test suite to your React/Next.js project using Jest and React Testing Library. Make sure to write comprehensive tests for your components to maintain code quality and prevent future regressions.