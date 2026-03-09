To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, configuration files, or documentation to identify all the necessary environment variables that your application requires to run properly.

2. **Create the `.env.example` File**: Open your text editor or IDE and create a new file named `.env.example`.

3. **Document the Environment Variables**: For each required environment variable, add a line in the `.env.example` file. Use a format that clearly indicates the variable name and a placeholder value or description. Here’s a template you can use:

```plaintext
# Database Configuration
DB_HOST=your_database_host
DB_PORT=your_database_port
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# API Keys
API_KEY=your_api_key
API_SECRET=your_api_secret

# Application Settings
APP_ENV=your_app_environment  # e.g., development, production
APP_DEBUG=true_or_false       # Enable or disable debug mode
APP_URL=your_application_url

# Other Configuration
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
JWT_SECRET=your_jwt_secret
```

4. **Add Comments**: Include comments to explain what each variable is for, as shown in the template above. This will help other developers understand the purpose of each variable.

5. **Save the File**: Save the `.env.example` file in the root directory of your project or wherever your application expects to find it.

6. **Commit the Changes**: If you are using version control (like Git), make sure to add the new file to your repository and commit the changes.

Here’s an example of how the final `.env.example` file might look:

```plaintext
# Database Configuration
DB_HOST=your_database_host
DB_PORT=your_database_port
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# API Keys
API_KEY=your_api_key
API_SECRET=your_api_secret

# Application Settings
APP_ENV=your_app_environment  # e.g., development, production
APP_DEBUG=true_or_false       # Enable or disable debug mode
APP_URL=your_application_url

# Other Configuration
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
JWT_SECRET=your_jwt_secret
```

This `.env.example` file serves as a template for developers to create their own `.env` file with actual values, ensuring that they have all the necessary environment variables configured for the application to run.