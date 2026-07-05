// backend/src/utils/cronJobs.js
import cron from 'node-cron';
import { supabase } from '../config/supabaseClient.js';

export const startCronJobs = () => {
    // Schedule: Runs at 00:00 (midnight) every single day
    cron.schedule('0 0 * * *', async () => {
        console.log('🧹 [CRON] Starting weekly demo user cleanup...');
        
        try {
            // Trigger the secure RPC function in Supabase
            const { error } = await supabase.rpc('cleanup_demo_users');
            
            if (error) throw error;
            
            console.log('✅ [CRON] Demo cleanup completed successfully.');
        } catch (error) {
            console.error('❌ [CRON] Demo cleanup failed:', error.message);
        }
    });

    console.log('⏰ Cron jobs initialized.');
};