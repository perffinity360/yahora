// backend/src/modules/messages/messages.routes.js
import express from 'express';
import { getInbox, getChatHistory, sendMessage, markAsRead, markAsDelivered} from './messages.controller.js';

const router = express.Router();

router.get('/inbox/:userId', getInbox);
router.get('/history', getChatHistory);
router.post('/send', sendMessage);
router.put('/read', markAsRead);
router.put('/deliver', markAsDelivered);

export default router;