To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, configuration files, or documentation to identify all the environment variables that your application requires to run.

2. **Create the `.env.example` File**: Open your text editor or IDE and create a new file named `.env.example`.

3. **Document the Variables**: In the `.env.example` file, list each required environment variable along with a brief description of its purpose. Use placeholder values to indicate the type of value expected (e.g., `YOUR_VALUE_HERE`).

Here’s an example structure for your `.env.example` file:

```plaintext
# Database Configuration
DB_HOST=YOUR_DB_HOST_HERE  # Database host (e.g., localhost)
DB_PORT=YOUR_DB_PORT_HERE  # Database port (e.g., 5432)
DB_USER=YOUR_DB_USER_HERE  # Database username
DB_PASSWORD=YOUR_DB_PASSWORD_HERE  # Database password
DB_NAME=YOUR_DB_NAME_HERE  # Database name

# API Keys
API_KEY=YOUR_API_KEY_HERE  # API key for external service
SECRET_KEY=YOUR_SECRET_KEY_HERE  # Secret key for encryption

# Application Settings
APP_ENV=YOUR_APP_ENV_HERE  # Environment (e.g., development, production)
APP_PORT=YOUR_APP_PORT_HERE  # Port on which the app runs
DEBUG_MODE=YOUR_DEBUG_MODE_HERE  # Debug mode (true/false)

# Other Variables
# Add any other necessary environment variables here
```

4. **Save the File**: Save the `.env.example` file in the root directory of your project or wherever your application expects to find it.

5. **Commit the Changes**: If you are using version control (like Git), make sure to add and commit the new `.env.example` file to your repository.

6. **Update Documentation**: If you have project documentation, consider adding a note about the `.env.example` file and how to create a `.env` file from it.

By following these steps, you will have successfully created a `.env.example` file that serves as a template for required environment variables in your project.