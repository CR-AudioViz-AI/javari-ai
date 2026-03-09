To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, documentation, or any existing configuration files to identify all the necessary environment variables.

2. **Create the `.env.example` File**: Open your code editor and create a new file named `.env.example`.

3. **Document the Environment Variables**: In the `.env.example` file, list each required environment variable along with a brief description of its purpose. Use placeholder values to indicate the expected format or type of each variable.

Here’s a sample structure for the `.env.example` file:

```plaintext
# .env.example

# Database configuration
DB_HOST=your_database_host  # e.g., localhost or IP address
DB_PORT=your_database_port  # e.g., 5432 for PostgreSQL
DB_USER=your_database_user  # e.g., admin
DB_PASSWORD=your_database_password  # e.g., secure_password
DB_NAME=your_database_name  # e.g., my_database

# API keys
API_KEY=your_api_key  # e.g., 1234567890abcdef
API_SECRET=your_api_secret  # e.g., secret_key

# Application settings
APP_ENV=your_app_environment  # e.g., development, production
APP_DEBUG=true_or_false  # e.g., true or false
APP_URL=your_application_url  # e.g., http://localhost:3000

# Other configurations
JWT_SECRET=your_jwt_secret  # e.g., a long random string
MAIL_HOST=your_mail_host  # e.g., smtp.mailtrap.io
MAIL_PORT=your_mail_port  # e.g., 587
MAIL_USERNAME=your_mail_username  # e.g., user@example.com
MAIL_PASSWORD=your_mail_password  # e.g., mail_password
```

4. **Save the File**: Save the `.env.example` file in the root directory of your project.

5. **Commit the Changes**: If you are using version control (like Git), make sure to add the `.env.example` file to your repository and commit the changes.

6. **Update Documentation**: If you have a README or other documentation, consider adding a note about the `.env.example` file and how to use it to set up the environment variables for the application.

By following these steps, you will have successfully created a `.env.example` file that serves as a template for required environment variables in your project.