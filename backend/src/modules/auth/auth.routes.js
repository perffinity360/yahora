import express from 'express';
import { requestOtp, verifyOtp, completeOnboarding, demoLogin} from './auth.controller.js';

const router = express.Router();

// POST /api/auth/request-otp
router.post('/request-otp', requestOtp);

// POST /api/auth/verify-otp
router.post('/verify-otp', verifyOtp);

// POST /api/auth/onboarding
router.post('/onboarding', completeOnboarding);

// POST /api/auth/demo-login 
router.post('/demo-login', demoLogin);

export default router;