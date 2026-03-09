To execute the roadmap task of adding a test suite to your project, follow these steps:

### Step 1: Install Testing Libraries

First, you need to install Jest and React Testing Library. If you are using npm, run the following command in your project directory:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

If you are using Yarn, you can run:

```bash
yarn add --dev jest @testing-library/react @testing-library/jest-dom
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

Create a file named `setupTests.js` in the root of your project. This file will be used to configure the testing environment. Add the following content:

```javascript
import '@testing-library/jest-dom/extend-expect';
```

### Step 4: Create Your First Test

Create a directory for your tests, typically named `__tests__` or `tests`. Inside this directory, create a test file for one of your components. For example, if you have a component named `MyComponent.js`, create a file named `MyComponent.test.js`:

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

Now you can run your tests using the following command:

```bash
npm test
```

or

```bash
yarn test
```

### Step 7: Add More Tests

Continue to add more unit and integration tests for your components and functions to ensure that your application is well-tested and to prevent regressions in the future.

### Step 8: Continuous Integration (Optional)

If you are using a CI/CD pipeline, make sure to integrate your test suite into your build process to automatically run tests on each commit or pull request.

### Conclusion

By following these steps, you will have successfully added a test suite to your React/Next.js project using Jest and Testing Library. This will help you catch regressions and ensure the reliability of your application.