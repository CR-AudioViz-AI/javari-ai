To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, documentation, or any existing configuration files to determine which environment variables are necessary for your application to run.

2. **Create the `.env.example` File**: Open your code editor and create a new file named `.env.example`.

3. **Document the Environment Variables**: In the `.env.example` file, list each required environment variable along with a brief description of its purpose. Use placeholder values to indicate the expected format or type of value.

Here’s a sample structure for your `.env.example` file:

```plaintext
# .env.example

# Database configuration
DB_HOST=your_database_host  # e.g., localhost
DB_PORT=your_database_port  # e.g., 5432
DB_USER=your_database_user  # e.g., user123
DB_PASSWORD=your_database_password  # e.g., password123
DB_NAME=your_database_name  # e.g., my_database

# Application settings
APP_ENV=your_application_environment  # e.g., development, production
APP_DEBUG=true_or_false  # e.g., true
APP_URL=your_application_url  # e.g., http://localhost:3000

# API keys
API_KEY=your_api_key  # e.g., abc123xyz
SECRET_KEY=your_secret_key  # e.g., supersecretkey

# Other configurations
LOG_LEVEL=your_log_level  # e.g., info, debug
```

4. **Save the File**: Save the `.env.example` file in the root directory of your project.

5. **Commit the Changes**: If you are using version control (like Git), add the `.env.example` file to your repository and commit the changes.

```bash
git add .env.example
git commit -m "Add .env.example template for environment variables"
```

6. **Update Documentation**: If applicable, update your project documentation to inform other developers about the `.env.example` file and how to create their own `.env` file based on it.

By following these steps, you will have successfully created a `.env.example` file that serves as a template for documenting required environment variables without exposing any real values.