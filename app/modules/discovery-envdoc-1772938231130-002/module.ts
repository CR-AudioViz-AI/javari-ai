To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, configuration files, or documentation to identify all the environment variables that your application requires to run properly.

2. **Create the `.env.example` File**: Open your code editor and create a new file named `.env.example`.

3. **Document the Variables**: In the `.env.example` file, list each required environment variable along with a brief description of its purpose. Use placeholder values to indicate the expected format or type of value.

Here’s a sample structure for your `.env.example` file:

```plaintext
# Database Configuration
DB_HOST=your_database_host # e.g., localhost
DB_PORT=your_database_port # e.g., 5432
DB_USER=your_database_user # e.g., user123
DB_PASSWORD=your_database_password # e.g., password123
DB_NAME=your_database_name # e.g., my_database

# API Keys
API_KEY=your_api_key # e.g., ABCD1234EFGH5678
API_SECRET=your_api_secret # e.g., secret1234

# Application Settings
APP_ENV=your_app_environment # e.g., development, production
APP_DEBUG=true_or_false # e.g., true
APP_URL=your_application_url # e.g., http://localhost:3000

# Other Variables
JWT_SECRET=your_jwt_secret # e.g., supersecretkey
```

4. **Save the File**: After documenting all the required environment variables, save the `.env.example` file in the root directory of your project.

5. **Commit the Changes**: If you're using version control (like Git), make sure to add the `.env.example` file to your repository and commit the changes.

6. **Review and Update**: Periodically review and update the `.env.example` file as your application evolves and new environment variables are added or existing ones are modified.

By following these steps, you will have created a `.env.example` file that serves as a template for other developers to set up their environment variables without exposing sensitive information.