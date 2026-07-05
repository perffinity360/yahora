// backend\src\app.js
import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes.js'; 
import academicRoutes from './modules/academic/academic.routes.js';import universityRoutes from './modules/university/university.routes.js'; 
import userRoutes from './modules/user/user.routes.js';
import productRoutes from './modules/products/products.routes.js';
import messageRoutes from './modules/messages/messages.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// A simple health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Success', message: 'Yahora backend is up and running! 🚀...' });
});

app.get('/', (req, res) => {
    res.send('Yahora API is successfully running! 🚀...');
});

app.use('/api/auth', authRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/universities', universityRoutes);
app.use('/api/user', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/messages', messageRoutes);

export default app;