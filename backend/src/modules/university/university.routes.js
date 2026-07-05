import express from 'express';
import { getUniversities } from './university.controller.js';

const router = express.Router();

router.get('/', getUniversities);

export default router;