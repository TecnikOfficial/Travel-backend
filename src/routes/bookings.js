const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Tour = require('../models/Tour');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { auth, adminAuth } = require('../middleware/auth');
const razorpay = require('../utils/razorpay');
const crypto = require('crypto');

// Helper function to format booking response
const formatBookingResponse = async (booking) => {
    // Ensure all necessary fields are populated if not already
    if (!(booking.userId instanceof User)) {
        await booking.populate('userId', 'name email');
    }
    if (!(booking.packageId instanceof Tour)) {
        await booking.populate('packageId', 'name price imageUrl destination duration region');
    }

    const packageDetails = booking.packageId || {};
    const userDetails = booking.userId || {};

    return {
        id: booking._id,
        packageId: packageDetails._id || booking.packageId, // Fallback to ID if population failed
        packageName: packageDetails.name || 'N/A',
        userId: userDetails._id || booking.userId,
        customerName: userDetails.name || 'N/A',
        customerEmail: userDetails.email || 'N/A',
        bookingDate: booking.createdAt.toISOString(),
        travelDate: booking.travelDate ? booking.travelDate.toISOString() : undefined,
        numTravelers: booking.numTravelers,
        totalPrice: booking.totalPrice,
        status: booking.status,
        // Add any other fields from frontend Booking type if necessary
    };
};

// Get all bookings (admin only)
router.get('/', [auth, adminAuth], async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('userId', 'name email') // Changed from user
      .populate('packageId', 'name price imageUrl destination duration region') // Changed from tour, added more fields
      .sort({ createdAt: -1 });
    
    const formattedBookings = await Promise.all(bookings.map(formatBookingResponse));
    res.json(formattedBookings);
  } catch (error) {
    console.error("Error fetching all bookings:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id }) // Changed from user
      .populate('userId', 'name email') // Populate userId here
      .populate('packageId', 'name price imageUrl destination duration region') // Changed from tour, added more fields
      .sort({ createdAt: -1 });
    
    const formattedBookings = await Promise.all(bookings.map(formatBookingResponse)); // Pass the already populated booking
    res.json(formattedBookings);
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single booking
router.get('/:id', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'name email') // Changed from user
      .populate('packageId', 'name price imageUrl destination duration region'); // Changed from tour

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (req.user.role !== 'admin' && booking.userId._id.toString() !== req.user._id.toString()) { // Changed from booking.user._id
      return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(await formatBookingResponse(booking));
  } catch (error) {
    console.error("Error fetching single booking:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create booking with Razorpay payment
router.post('/', [
  auth,
  body('packageId').notEmpty().withMessage('Package ID is required'),
  body('travelDate').isISO8601().withMessage('Valid travel date is required'),
  body('numTravelers').isInt({ min: 1 }).withMessage('Number of travelers must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { packageId, travelDate, numTravelers } = req.body;
    console.log('Creating booking with data:', { packageId, travelDate, numTravelers });

    const userMakingBooking = await User.findById(req.user._id);
    if (!userMakingBooking) {
      console.error('User not found:', req.user._id);
      return res.status(404).json({ message: 'User performing booking not found'});
    }

    const tourPackage = await Tour.findById(packageId);
    if (!tourPackage) {
      console.error('Package not found:', packageId);
      return res.status(404).json({ message: 'Package not found' });
    }

    const totalPrice = tourPackage.price * numTravelers;
    console.log('Calculated total price:', totalPrice);

    // Create a pending booking entry
    const newBooking = new Booking({
      userId: req.user._id,
      packageId: packageId,
      travelDate: new Date(travelDate),
      numTravelers,
      totalPrice,
      status: 'Pending',
      razorpayOrderId: 'temp_' + Date.now() // Temporary ID until Razorpay order is created
    });

    await newBooking.save();
    console.log('Created pending booking:', newBooking._id);

    try {
      // Create Razorpay order
      const options = {
        amount: totalPrice * 100, // amount in the smallest currency unit (paise for INR)
        currency: 'INR',
        receipt: `receipt_booking_${newBooking._id}`,
        notes: {
          bookingId: newBooking._id.toString(),
          package: tourPackage.name,
          customer: userMakingBooking.name
        }
      };

      console.log('Creating Razorpay order with options:', options);
      const order = await razorpay.orders.create(options);
      console.log('Created Razorpay order:', order.id);
      
      // Update booking with Razorpay order ID
      newBooking.razorpayOrderId = order.id;
      await newBooking.save();
      console.log('Updated booking with Razorpay order ID');

      // Log activity
      try {
        const activityDetails = `User '${userMakingBooking.name}' initiated booking for package '${tourPackage.name}'.`;
        const activity = new ActivityLog({
          action: 'NEW_BOOKING',
          userId: req.user._id,
          bookingId: newBooking._id,
          details: activityDetails,
        });
        await activity.save();
        console.log('Created activity log entry');
      } catch (logError) {
        console.error("Failed to log new booking activity:", logError);
      }

      // Populate for response formatting
      await newBooking.populate('userId', 'name email');
      await newBooking.populate('packageId', 'name price imageUrl destination duration region');

      res.json({
        order,
        booking: await formatBookingResponse(newBooking),
        keyId: process.env.RAZORPAY_KEY_ID
      });

    } catch (razorpayError) {
      console.error('Razorpay order creation failed:', razorpayError);
      // If Razorpay order creation fails, delete the pending booking
      await Booking.findByIdAndDelete(newBooking._id);
      throw razorpayError;
    }

  } catch (error) {
    console.error("Booking creation error:", error);
    res.status(500).json({ 
      message: 'Error creating booking',
      error: error.message || 'Unknown error occurred'
    });
  }
});

// Verify Razorpay payment and update booking
router.post('/verify-payment', auth, [
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
  body('bookingId').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: 'Invalid Razorpay Order ID for this booking' });
    }

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Payment is successful
      booking.status = 'Confirmed';
      booking.paymentId = razorpay_payment_id;
      booking.paymentSignature = razorpay_signature;
      await booking.save();

      // Log successful payment
      try {
        const activity = new ActivityLog({
          action: 'PAYMENT_CONFIRMED',
          userId: booking.userId,
          bookingId: booking._id,
          details: `Payment confirmed for booking ${booking._id}`,
        });
        await activity.save();
      } catch (logError) {
        console.error("Failed to log payment confirmation:", logError);
      }

      // Populate for response
      await booking.populate('userId', 'name email');
      await booking.populate('packageId', 'name price imageUrl destination duration region');
      
      res.json({ 
        message: 'Payment verified successfully', 
        booking: await formatBookingResponse(booking) 
      });
    } else {
      res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ message: 'Server error during payment verification' });
  }
});

// Update booking status (admin only)
router.patch('/:id/status', [
  auth,
  adminAuth,
  body('status').isIn(['Pending', 'Confirmed', 'Cancelled', 'Completed']).withMessage('Invalid status') // Updated enum
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { status } }, // Only update status
      { new: true }
    )
    .populate('userId', 'name email')
    .populate('packageId', 'name price imageUrl destination duration region');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(await formatBookingResponse(booking));
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel booking (user or admin)
router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('userId', 'name email'); // Populate userId for check and response

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (req.user.role !== 'admin' && booking.userId._id.toString() !== req.user._id.toString()) { // Changed from booking.user
      return res.status(403).json({ message: 'Not authorized to cancel this booking' });
    }

    if (booking.status === 'Cancelled' || booking.status === 'Completed') { // Updated condition
      return res.status(400).json({ message: `Booking is already ${booking.status.toLowerCase()}` });
    }

    booking.status = 'Cancelled'; // Updated status value
    await booking.save();
    
    // Repopulate packageId for consistent response
    await booking.populate('packageId', 'name price imageUrl destination duration region');

    res.json(await formatBookingResponse(booking));
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 