To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, configuration files, or documentation to identify all the necessary environment variables.

2. **Create the `.env.example` File**: Open your text editor or IDE and create a new file named `.env.example`.

3. **Document the Variables**: For each environment variable, add a line in the `.env.example` file. Use a comment to describe the purpose of each variable. Ensure that you do not include any real values.

Here’s a sample structure for your `.env.example` file:

```plaintext
# Database configuration
DB_HOST=your_database_host
DB_PORT=your_database_port
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# API keys
API_KEY=your_api_key
API_SECRET=your_api_secret

# Application settings
APP_ENV=your_application_environment
APP_DEBUG=true_or_false
APP_URL=your_application_url

# Other configurations
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
```

4. **Save the File**: Save the `.env.example` file in the root directory of your project or wherever it is appropriate based on your project structure.

5. **Commit the Changes**: If you are using version control (like Git), add the `.env.example` file to your repository and commit the changes.

```bash
git add .env.example
git commit -m "Add .env.example template for environment variables"
```

6. **Update Documentation**: If you have a README or other documentation, consider adding a note about the `.env.example` file and how to create a `.env` file from it.

By following these steps, you will have successfully created a `.env.example` file that serves as a template for documenting required environment variables without exposing sensitive information.