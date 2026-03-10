To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, documentation, or any existing configuration files to identify all the environment variables that your application requires.

2. **Create the `.env.example` File**: Open your code editor and create a new file named `.env.example`.

3. **Document the Variables**: For each required environment variable, add a line in the `.env.example` file. Use a placeholder value or simply leave it blank to indicate that the user should fill in their own values. You can also add comments to describe what each variable is for.

Here’s a sample structure for the `.env.example` file:

```plaintext
# Database configuration
DB_HOST=your_database_host
DB_PORT=your_database_port
DB_USER=your_database_username
DB_PASSWORD=your_database_password
DB_NAME=your_database_name

# API keys
API_KEY=your_api_key
ANOTHER_API_KEY=your_another_api_key

# Application settings
APP_ENV=development
APP_DEBUG=true
APP_PORT=3000

# Other configurations
SECRET_KEY=your_secret_key
```

4. **Save the File**: Save the `.env.example` file in the root of your project directory.

5. **Commit the Changes**: If you are using version control (like Git), make sure to add the new `.env.example` file to your repository and commit the changes.

6. **Update Documentation**: If you have any project documentation, consider adding a note about the `.env.example` file and how to use it to set up the environment variables.

By following these steps, you will have successfully created a `.env.example` file that serves as a template for documenting required environment variables for your project.