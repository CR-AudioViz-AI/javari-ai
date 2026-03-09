To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, documentation, or any existing configuration files to determine which environment variables are necessary for the application to run.

2. **Create the `.env.example` File**: Open your code editor and create a new file named `.env.example`.

3. **Document the Environment Variables**: In the `.env.example` file, list each required environment variable along with a brief description of its purpose. Use placeholder values to indicate the expected format without revealing any sensitive information.

Here’s a sample structure for the `.env.example` file:

```plaintext
# .env.example

# Database configuration
DB_HOST=your_database_host
DB_PORT=your_database_port
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# Application settings
APP_ENV=your_application_environment  # e.g., development, production
APP_DEBUG=true                         # Set to false in production
APP_URL=http://your_application_url

# API keys
API_KEY=your_api_key
ANOTHER_SERVICE_API_KEY=your_service_api_key

# Other configurations
SECRET_KEY=your_secret_key
```

4. **Save the File**: Save the `.env.example` file in the root directory of your project or in the appropriate configuration directory.

5. **Commit the Changes**: If you are using version control (like Git), add the `.env.example` file to your repository and commit the changes.

```bash
git add .env.example
git commit -m "Add .env.example template for environment variables"
```

6. **Update Documentation**: If applicable, update your project documentation to inform other developers about the existence of the `.env.example` file and how to use it to set up their own `.env` files.

By following these steps, you will have successfully created a `.env.example` file that serves as a template for documenting required environment variables.