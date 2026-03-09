To execute the roadmap task of adding a test suite to your project, follow these steps:

### Step 1: Install Required Packages

First, you need to install Jest and Testing Library. Open your terminal and run the following command:

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

Create a file named `setupTests.js` in the root of your project. This file will be used to configure the Testing Library and Jest:

```javascript
import '@testing-library/jest-dom/extend-expect';
```

### Step 4: Write Your First Test

Create a directory for your tests, typically named `__tests__` or `tests`. Inside this directory, create a test file for a component. For example, if you have a component named `MyComponent.js`, create a file named `MyComponent.test.js`:

```javascript
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

test('renders MyComponent', () => {
  render(<MyComponent />);
  const linkElement = screen.getByText(/some text/i);
  expect(linkElement).toBeInTheDocument();
});
```

### Step 5: Update Package.json

Add a test script to your `package.json` file:

```json
"scripts": {
  "test": "jest"
}
```

### Step 6: Run Your Tests

Now that everything is set up, you can run your tests with the following command:

```bash
npm test
```

### Step 7: Add More Tests

Continue adding unit and integration tests for your components and functions to ensure that your application is well-tested and to prevent regressions in the future.

### Step 8: Continuous Integration (Optional)

If you are using a CI/CD pipeline, make sure to include the test command in your pipeline configuration to run tests automatically on each commit or pull request.

### Conclusion

You have successfully added a test suite to your React/Next.js project using Jest and Testing Library. Continue to write tests for all your components and logic to maintain a robust codebase.