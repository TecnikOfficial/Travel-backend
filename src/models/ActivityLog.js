const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'NEW_BOOKING',
      'BOOKING_CANCELLED',
      'BOOKING_UPDATED',
      'PAYMENT_CONFIRMED'
    ], // Expanded for all relevant actions
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  details: {
    type: String, // e.g., "User [UserName] booked [PackageName]"
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

activityLogSchema.index({ timestamp: -1 }); // Index for efficient sorting

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog; 