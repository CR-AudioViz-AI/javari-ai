To execute the roadmap task of adding a test suite to your React/Next.js project, follow these steps:

### Step 1: Install Testing Libraries

First, you'll need to install Jest and React Testing Library. Open your terminal and run the following command:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

If you're using TypeScript, you might also want to install the types for Jest:

```bash
npm install --save-dev @types/jest
```

### Step 2: Configure Jest

Create a configuration file for Jest. You can do this by creating a file named `jest.config.js` in the root of your project with the following content:

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  moduleNameMapper: {
    '\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
};
```

### Step 3: Create Setup File

Create a file named `setupTests.js` in the root of your project. This file will allow you to set up any global configurations or imports for your tests. For example:

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

### Step 5: Update Package.json Scripts

Add a script to your `package.json` to run the tests easily. Under the `scripts` section, add:

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

If you are using a CI/CD pipeline, consider adding your test command to your CI configuration to ensure that tests are run on every push or pull request.

### Conclusion

By following these steps, you will have successfully added a test suite to your React/Next.js project using Jest and React Testing Library. Make sure to regularly write tests as you develop new features to maintain code quality and prevent regressions.