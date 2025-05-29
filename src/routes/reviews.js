const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
// const Review = require('../models/Review'); // Remove Review model
const Tour = require('../models/Tour');
const { auth } = require('../middleware/auth');

// @route   POST /api/reviews
// @desc    Submit a review for a tour
// @access  Private
router.post('/', [
  auth,
  body('packageId', 'Package ID is required').notEmpty(),
  body('rating', 'Rating is required and must be between 1 and 5').isInt({ min: 1, max: 5 }),
  body('comment', 'Comment is required').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { packageId, rating, comment } = req.body;

  try {
    const tour = await Tour.findById(packageId);
    if (!tour) {
      return res.status(404).json({ message: 'Package not found' });
    }

    // Prevent duplicate review
    const existingReview = tour.reviews.find(rev => rev.user.toString() === req.user._id.toString());
    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this package' });
    }

    const newReview = {
      user: req.user._id,
      userName: req.user.name, 
      rating: parseInt(rating),
      comment,
      createdAt: new Date()
    };

    tour.reviews.push(newReview);
    tour.calculateAverageRating();
    await tour.save();
    const savedReview = tour.reviews[tour.reviews.length - 1];
    res.status(201).json(savedReview);
  } catch (error) {
    console.error("Error submitting review:", error.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/reviews/:tourId
// @desc    Get reviews for a specific tour
// @access  Public
router.get('/:tourId', async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.tourId).populate('reviews.user', 'name'); // Populate user name in reviews

    if (!tour) {
      return res.status(404).json({ message: 'Tour not found' });
    }
    
    // The reviews array in Tour schema has `userName` directly if user is not populated.
    // If populating `reviews.user` we get the user object.
    // Frontend might expect `userName` directly. Let's ensure consistency.
    const reviewsToReturn = tour.reviews.map(review => ({
        id: review._id, // Mongoose subdocuments have _id
        user: review.user?._id || review.user, // Send user ID
        userName: review.user?.name || review.userName || 'Anonymous', // Use populated name, fallback to stored userName
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(), // Ensure consistent date format
        // packageId is implicit from the request to /:tourId
    }));


    if (!reviewsToReturn || reviewsToReturn.length === 0) {
      // It's better to return an empty array if no reviews, rather than 404,
      // as the tour itself exists.
      return res.json([]);
    }

    res.json(reviewsToReturn.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())); // Sort by date descending

  } catch (error) {
    console.error("Error fetching reviews:", error.message);
    res.status(500).send('Server Error');
  }
});

// Edit a review (user or admin)
router.put('/:reviewId', auth, async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;
  try {
    // Find the tour containing this review
    const tour = await Tour.findOne({ 'reviews._id': reviewId });
    if (!tour) return res.status(404).json({ message: 'Review not found' });
    const review = tour.reviews.id(reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    // Only the review owner or admin can edit
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to edit this review' });
    }
    if (rating) review.rating = rating;
    if (comment) review.comment = comment;
    review.createdAt = new Date(); // Optionally update timestamp
    tour.calculateAverageRating();
    await tour.save();
    res.json(review);
  } catch (error) {
    console.error('Error editing review:', error.message);
    res.status(500).send('Server Error');
  }
});

// Delete a review (user or admin)
router.delete('/:reviewId', auth, async (req, res) => {
  const { reviewId } = req.params;
  try {
    const tour = await Tour.findOne({ 'reviews._id': reviewId });
    if (!tour) return res.status(404).json({ message: 'Review not found' });
    const review = tour.reviews.id(reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });
    // Only the review owner or admin can delete
    if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }
    tour.reviews.pull(reviewId); // Use pull instead of remove
    tour.calculateAverageRating();
    await tour.save();
    res.json({ message: 'Review deleted' });
  } catch (error) {
    console.error('Error deleting review:', error.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router; 