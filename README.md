# North East Adventure Tour Planner - Backend

This is the backend server for the North East Adventure Tour Planner application. It provides RESTful APIs for managing tour bookings, user authentication, and payment processing.

## Tech Stack

- Node.js
- Express.js
- MongoDB (with Mongoose)
- JWT for Authentication
- Razorpay for Payment Processing

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn package manager

## Installation

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   ```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reload
- `npm test` - Run tests (not configured yet)

## Project Structure

```
backend/
├── src/
│   ├── server.js          # Main application entry point
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   └── utils/            # Utility functions
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register a new user
- POST `/api/auth/login` - Login user
- GET `/api/auth/profile` - Get user profile (protected route)

### Tours
- GET `/api/tours` - Get all tours
- GET `/api/tours/:id` - Get tour by ID
- POST `/api/tours` - Create new tour (admin only)
- PUT `/api/tours/:id` - Update tour (admin only)
- DELETE `/api/tours/:id` - Delete tour (admin only)

### Bookings
- POST `/api/bookings` - Create new booking
- GET `/api/bookings` - Get user's bookings
- GET `/api/bookings/:id` - Get booking details
- PUT `/api/bookings/:id` - Update booking status

### Payments
- POST `/api/payments/create` - Create payment order
- POST `/api/payments/verify` - Verify payment

## Security

- JWT-based authentication
- Password hashing using bcrypt
- CORS enabled
- Input validation using express-validator
- Environment variables for sensitive data

## Error Handling

The API uses a centralized error handling mechanism. All errors are returned in the following format:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License. 