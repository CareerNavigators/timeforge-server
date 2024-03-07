# TimeForge Backend Server

## Introduction:

TimeForge Backend Server serves as the backbone of the TimeForge project, providing essential functionalities for event management and user authentication.

## Environment Variables:

### How to Obtain Configuration Variables

### Configuration Variables

#### Daily

- **DAILY_TOKEN:** [Daily.co](http://daily.co/)

#### OAuth2

- **GOOGLE_CLIENT_ID:** [Google](https://console.cloud.google.com/apis/credentials) 
- **GOOGLE_CLIENT_SECRET:** [Google](https://console.cloud.google.com/apis/credentials) 
- **GOOGLE_REDIRECT_URI:** [Google](https://console.cloud.google.com/apis/credentials) 

#### Database

- **DB_USER:** MongoDB username
- **DB_PASSWORD:** MongoDB password

#### Gmail

- **MAIL:** Gmail
- **PASS:** Gmail Apps Password

#### Firebase

- **TYPE:** service_account 
- **PROJECT_ID:** Firebase project id
- **PRIVATE_KEY_ID:** Firebase project private ID
- **PRIVATE_KEY:** Firebase project private key
- **CLIENT_EMAIL:** Service account mail
- **CLIENT_ID:** Service account Id
- **AUTH_URI:** https://accounts.google.com/o/oauth2/auth
- **TOKEN_URI:** https://oauth2.googleapis.com/token
- **AUTH_PROVIDER_X509_CERT_URL:** https://www.googleapis.com/oauth2/v1/certs
- **CLIENT_X509_CERT_URL:** CERT url of googleapi

#### Universe

- **UNIVERSE_DOMAIN:** googleapis.com


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
