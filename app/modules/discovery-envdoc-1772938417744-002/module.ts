To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, documentation, or any existing configuration files to determine which environment variables are necessary for your application to run.

2. **Create the `.env.example` File**: Open your code editor and create a new file named `.env.example`.

3. **Document the Variables**: In the `.env.example` file, list each required environment variable along with a brief description of its purpose. Use placeholder values to indicate the expected format or type of each variable.

Here’s an example of what the `.env.example` file might look like:

```plaintext
# .env.example

# Database configuration
DB_HOST=your_database_host  # e.g., localhost or IP address
DB_PORT=your_database_port  # e.g., 5432 for PostgreSQL
DB_USER=your_database_user  # e.g., admin
DB_PASSWORD=your_database_password  # e.g., secret

# Application settings
APP_ENV=your_application_environment  # e.g., development, production
APP_DEBUG=true_or_false  # e.g., true or false
APP_URL=your_application_url  # e.g., http://localhost:3000

# API keys
API_KEY=your_api_key  # e.g., 1234567890abcdef
SECRET_KEY=your_secret_key  # e.g., a long random string

# Other configurations
REDIS_HOST=your_redis_host  # e.g., localhost
REDIS_PORT=your_redis_port  # e.g., 6379
```

4. **Save the File**: Save the `.env.example` file in the root directory of your project or in the appropriate configuration directory.

5. **Commit the Changes**: If you are using version control (like Git), make sure to add the `.env.example` file to your repository and commit the changes.

6. **Update Documentation**: If you have any project documentation, consider adding a note about the `.env.example` file and how to use it to set up the environment variables for new developers or deployments.

By following these steps, you will have successfully created a `.env.example` file that serves as a template for required environment variables in your project.