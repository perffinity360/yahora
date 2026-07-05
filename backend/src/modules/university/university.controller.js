// backend\src\modules\university\university.controller.js
import { supabase } from '../../config/supabaseClient.js';

export const getUniversities = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('universities')
            .select('id, name, domain')
            .order('name');

        if (error) throw error;
        
        res.status(200).json(data);
    } catch (error) {
        console.error('Fetch Universities Error:', error);
        res.status(500).json({ error: 'Failed to fetch universities' });
    }
};