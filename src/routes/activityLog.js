const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { auth, adminAuth } = require('../middleware/auth');

// GET /api/activitylog/recent-bookings - Get recent new booking activities (admin only)
router.get('/recent-bookings', [auth, adminAuth], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20; // Default to 20, allow client to specify limit
    const activities = await ActivityLog.find({ action: 'NEW_BOOKING' })
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'name email') // Populate user details
      .populate('bookingId', 'status totalPrice'); // Populate some booking details for context

    res.json(activities);
  } catch (error) {
    console.error("Error fetching recent booking activities:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 