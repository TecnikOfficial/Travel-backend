const Razorpay = require('razorpay');
const dotenv = require('dotenv');

// Load environment variables if not already loaded (important for standalone use or testing)
dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

module.exports = razorpay; 