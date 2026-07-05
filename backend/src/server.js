// backend\src\server.js
import app from './app.js';
import dotenv from 'dotenv';
import { startCronJobs } from './utils/cronJobs.js';

// Load env variables from the backend root
dotenv.config(); 

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);

    startCronJobs();
});