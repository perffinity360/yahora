import express from 'express';
import { getCourses, getSpecializations } from './academic.controller.js';

const router = express.Router();

router.get('/courses', getCourses);
router.get('/specializations', getSpecializations);

export default router;