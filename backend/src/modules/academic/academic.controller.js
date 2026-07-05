import { supabase } from '../../config/supabaseClient.js';

export const getCourses = async (req, res) => {
    try {
        const { data, error } = await supabase.from('courses').select('id, name').order('name');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
};

export const getSpecializations = async (req, res) => {
    try {
        const { data, error } = await supabase.from('specializations').select('id, name').order('name');
        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch specializations' });
    }
};