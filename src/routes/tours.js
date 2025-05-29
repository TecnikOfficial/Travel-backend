const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Tour = require('../models/Tour');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

// Get all tours
router.get('/', async (req, res) => {
  try {
    const { region, minPrice, maxPrice, search, duration, rating } = req.query;
    let query = {};

    if (region) query.region = region;
    if (duration) query.duration = Number(duration);
    if (rating) query.rating = { $gte: Number(rating) };

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { longDescription: { $regex: search, $options: 'i' } },
        { destination: { $regex: search, $options: 'i' } },
        { region: { $regex: search, $options: 'i' } }
      ];
    }

    const tours = await Tour.find(query)
                            .populate({
                                path: 'reviews.user',
                                select: 'name'
                            })
                            .sort({ createdAt: -1 });

    const toursWithReviewUserNames = tours.map(tour => {
        const tourObject = tour.toObject();
        tourObject.reviews = tourObject.reviews.map(review => ({
            ...review,
            userName: review.user ? review.user.name : 'Unknown User'
        }));
        return tourObject;
    });

    res.json(toursWithReviewUserNames);
  } catch (error) {
    console.error("Error fetching tours:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get featured tours
router.get('/featured', async (req, res) => {
  try {
    const tours = await Tour.find({ featured: true })
                            .populate({
                                path: 'reviews.user',
                                select: 'name'
                            })
                            .limit(6);
    const toursWithReviewUserNames = tours.map(tour => {
        const tourObject = tour.toObject();
        tourObject.reviews = tourObject.reviews.map(review => ({
            ...review,
            userName: review.user ? review.user.name : 'Unknown User'
        }));
        return tourObject;
    });
    res.json(toursWithReviewUserNames);
  } catch (error) {
    console.error("Error fetching featured tours:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single tour
router.get('/:id', async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.id)
                           .populate({
                               path: 'reviews.user',
                               select: 'name'
                           });
    if (!tour) {
      return res.status(404).json({ message: 'Tour not found' });
    }

    const tourObject = tour.toObject();
    tourObject.reviews = tourObject.reviews.map(review => ({
        ...review,
        userName: review.user ? review.user.name : 'Unknown User'
    }));

    res.json(tourObject);
  } catch (error) {
    console.error("Error fetching single tour:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create tour (admin only)
router.post('/', [
  auth,
  adminAuth,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('longDescription').trim().notEmpty().withMessage('Long description is required'),
  body('destination').trim().notEmpty().withMessage('Destination is required'),
  body('region').optional().trim(),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('imageUrls').optional().isArray().withMessage('Image URLs must be an array'),
  body('imageUrls.*').optional().isURL().withMessage('Each image URL must be valid'),
  body('activities').optional().isArray().withMessage('Activities must be an array'),
  body('activities.*').trim().notEmpty().withMessage('Activity description cannot be empty'),
  body('whatsIncluded').optional().isArray().withMessage('What\'s Included must be an array'),
  body('whatsIncluded.*').trim().notEmpty().withMessage('Included item description cannot be empty'),
  body('bestTimeToVisit').optional().trim(),
  body('featured').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tour = new Tour(req.body);
    await tour.save();
    res.status(201).json(tour);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update tour (admin only)
router.put('/:id', [
  auth,
  adminAuth,
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('longDescription').optional().trim().notEmpty().withMessage('Long description cannot be empty'),
  body('destination').optional().trim().notEmpty().withMessage('Destination cannot be empty'),
  body('region').optional().trim(),
  body('duration').optional().isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('imageUrls').optional().isArray().withMessage('Image URLs must be an array'),
  body('imageUrls.*').optional().isURL().withMessage('Each image URL must be valid'),
  body('activities').optional().isArray().withMessage('Activities must be an array'),
  body('activities.*').optional().trim().notEmpty().withMessage('Activity description cannot be empty'),
  body('whatsIncluded').optional().isArray().withMessage('What\'s Included must be an array'),
  body('whatsIncluded.*').optional().trim().notEmpty().withMessage('Included item description cannot be empty'),
  body('bestTimeToVisit').optional().trim(),
  body('featured').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tour = await Tour.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!tour) {
      return res.status(404).json({ message: 'Tour not found' });
    }

    res.json(tour);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete tour (admin only)
router.delete('/:id', [auth, adminAuth], async (req, res) => {
  try {
    const tour = await Tour.findByIdAndDelete(req.params.id);
    if (!tour) {
      return res.status(404).json({ message: 'Tour not found' });
    }
    res.json({ message: 'Tour deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add review to tour
router.post('/:id/reviews', [
  auth,
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').trim().notEmpty().withMessage('Comment is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tour = await Tour.findById(req.params.id);
    if (!tour) {
      return res.status(404).json({ message: 'Tour not found' });
    }

    const { rating, comment } = req.body;
    const review = {
      user: req.user._id,
      userName: req.user.name,
      rating,
      comment,
    };

    tour.reviews.push(review);
    tour.calculateAverageRating();
    await tour.save();
    
    const populatedTour = await Tour.findById(tour._id).populate('reviews.user', 'name');
    
    const tourObject = populatedTour.toObject();
    tourObject.reviews = tourObject.reviews.map(r => ({
        ...r,
        userName: r.user ? r.user.name : (r.userName || 'Unknown User'),
    }));

    res.status(201).json(tourObject);
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 