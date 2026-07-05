import express from 'express';
import multer from 'multer';
import { getDashboardData, updateProfile, updateAvatar, getPublicProfile} from './user.controller.js';

const router = express.Router();

// Configure multer to store file in memory (buffer) temporarily
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/user/:userId/dashboard
router.get('/:userId/dashboard', getDashboardData);

// PUT /api/user/:userId/profile
router.put('/:userId/profile', updateProfile);

// POST /api/user/:userId/avatar -> New route for handling image uploads
router.post('/:userId/avatar', upload.single('avatar'), updateAvatar);

// Public Profile
router.get('/:userId/public', getPublicProfile);

export default router;