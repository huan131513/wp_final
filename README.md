# NTU Campus Map

This project is a Next.js application for displaying NTU campus facilities (toilets, nursing rooms, accessible toilets).

## Setup Instructions

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    A `.env.local` file has been created for you. Please fill in the following values:
    - `DATABASE_URL`: Connection string for your PostgreSQL database.
    - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Your Google Maps API Key.
    - `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`: Your Google Maps Map ID (required for Advanced Markers).
    - `NEXTAUTH_SECRET`: A random string for session security.
    - `ADMIN_PASSWORD`: The password for accessing the admin dashboard.

3.  **Database Setup:**
    This project uses Prisma 7 with PostgreSQL.
    After setting up `DATABASE_URL` in `.env.local`:

    ```bash
    # Run migrations to create tables
    npx prisma migrate dev --name init
    
    # Or push schema directly
    npx prisma db push
    ```

4.  **Run Development Server:**
```bash
npm run dev
    ```

5.  **Admin Access:**
    Go to `/admin` to log in.

## Deployment

Deploy on Vercel using the standard Next.js deployment flow. Remember to set the environment variables in your Vercel project settings.
