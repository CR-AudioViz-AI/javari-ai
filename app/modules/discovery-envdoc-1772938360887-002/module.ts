To create a `.env.example` file that documents all required environment variables without real values, follow these steps:

1. **Identify Required Environment Variables**: Review your application code, configuration files, or documentation to identify all the environment variables that your application requires to run.

2. **Create the `.env.example` File**: Open your text editor or IDE and create a new file named `.env.example`.

3. **Document the Variables**: For each environment variable, add a line in the `.env.example` file. Use a placeholder value or a comment to indicate what type of value is expected. Here’s a sample structure:

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
APP_ENV=development # or production
APP_DEBUG=true # or false
APP_URL=http://yourappurl.com

# Other configurations
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
```

4. **Save the File**: Save the `.env.example` file in the root directory of your project or in the appropriate configuration directory.

5. **Review and Update**: Ensure that the file is comprehensive and accurately reflects all necessary environment variables. Update it as needed when new variables are added to the project.

6. **Commit to Version Control**: If you are using version control (like Git), make sure to add the `.env.example` file to your repository and commit the changes.

### Example `.env.example` File

Here’s a complete example of what your `.env.example` file might look like:

```plaintext
# Database configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=username
DB_PASSWORD=password
DB_NAME=database_name

# API keys
API_KEY=your_api_key
API_SECRET=your_api_secret

# Application settings
APP_ENV=development # Options: development, production
APP_DEBUG=true # Options: true, false
APP_URL=http://localhost:3000

# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Other configurations
JWT_SECRET=your_jwt_secret
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_mail_username
MAIL_PASSWORD=your_mail_password
```

This template serves as a guide for developers to set up their local environment without exposing sensitive information.