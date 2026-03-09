To execute the roadmap task of adding a test suite to your React/Next.js project, follow these steps:

### Step 1: Install Testing Libraries

First, you need to install Jest and React Testing Library. Open your terminal and run the following command:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

If you're using TypeScript, you might also want to install the types for Jest:

```bash
npm install --save-dev @types/jest
```

### Step 2: Configure Jest

Create a configuration file for Jest. You can do this by creating a file named `jest.config.js` in the root of your project:

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
};
```

### Step 3: Set Up Jest Environment

Create a `jest.setup.js` file in the root of your project to configure the testing environment:

```javascript
import '@testing-library/jest-dom/extend-expect';
```

### Step 4: Create Test Files

Create a directory for your tests, typically named `__tests__` or `tests`. Inside this directory, you can start adding your test files. For example, if you have a component named `MyComponent.js`, create a test file named `MyComponent.test.js`:

```javascript
import { render, screen } from '@testing-library/react';
import MyComponent from '../MyComponent';

test('renders MyComponent', () => {
  render(<MyComponent />);
  const linkElement = screen.getByText(/some text/i);
  expect(linkElement).toBeInTheDocument();
});
```

### Step 5: Update `package.json`

Add a test script to your `package.json` to make it easier to run your tests:

```json
"scripts": {
  "test": "jest"
}
```

### Step 6: Run Your Tests

Now that everything is set up, you can run your tests using the following command:

```bash
npm test
```

### Step 7: Write More Tests

Continue to add unit and integration tests for your components and pages. Aim to cover various scenarios, including edge cases, to ensure your application is robust and free from regressions.

### Step 8: Continuous Integration (Optional)

If you have a CI/CD pipeline, consider adding your test command to the pipeline configuration to ensure tests are run on every commit or pull request.

### Conclusion

By following these steps, you will have successfully added a test suite to your React/Next.js project using Jest and React Testing Library. This will help you catch regressions and maintain the quality of your codebase.