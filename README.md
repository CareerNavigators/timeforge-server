# TimeForge Backend Server

## Introduction:

TimeForge Backend Server serves as the backbone of the TimeForge project, providing essential functionalities for event management and user authentication.

## Environment Variables:

### How to Obtain Configuration Variables

### Configuration Variables

#### Daily

- **DAILY_TOKEN:**

#### OAuth2

- **GOOGLE_CLIENT_ID:**
- **GOOGLE_CLIENT_SECRET:**
- **GOOGLE_REDIRECT_URI:**

#### Database

- **DB_USER:**
- **DB_PASSWORD:**

#### Gmail

- **MAIL:**
- **PASS:**

#### Firebase

- **TYPE:**
- **PROJECT_ID:**
- **PRIVATE_KEY_ID:**
- **PRIVATE_KEY:**
- **CLIENT_EMAIL:**
- **CLIENT_ID:**
- **AUTH_URI:**
- **TOKEN_URI:**
- **AUTH_PROVIDER_X509_CERT_URL:**
- **CLIENT_X509_CERT_URL:**

#### Universe

- **UNIVERSE_DOMAIN:**


1. **Clone the repository:**

   ```bash
   git clone https://github.com/CareerNavigators/timeforge-server.git
   ```

2. **Navigate to the project directory:**

   ```bash
   cd timeforge-server
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Create a `.env` file:**

   - Create a `.env` file in the root directory of your project.
   - Copy the required environment variables from the provided `.env.example` file.

5. **Start the development server:**

   ```bash
   npm run dev
   ```

6. **View the app:**

   - Open your browser and navigate to [http://localhost:5111](http://localhost:5111) to view the server.

That's it! You've successfully set up and run the app with locally.
