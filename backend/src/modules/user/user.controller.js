import { supabase } from '../../config/supabaseClient.js';

// 1. Fetch all Dashboard Data
export const getDashboardData = async (req, res) => {
    try {
        const { userId } = req.params;

        // A. Fetch Profile (Joining courses and specializations to get the actual names)
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select(`
                *,
                course:courses(name),
                specialization:specializations(name),
                university:universities(name)
            `)
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        // B. Fetch User's Listings
        // B. Fetch User's Listings
        const { data: listings, error: listingsError } = await supabase
            .from('products')
            .select('id, title, description, category, condition, location, price, status, image_urls, created_at, likes_count, views, comments_count')
            .eq('seller_id', userId)
            .order('created_at', { ascending: false });

        if (listingsError) throw listingsError;

        // C. Fetch User's Purchases
        const { data: purchases, error: purchasesError } = await supabase
            .from('purchases')
            .select(`
                id,
                created_at,
                product:products(id, title, price, image_urls)
            `)
            .eq('buyer_id', userId)
            .order('created_at', { ascending: false });

        if (purchasesError) throw purchasesError;

        // Send everything formatted perfectly for the frontend
        res.status(200).json({
            profile: {
                ...profile,
                courseName: profile.course?.name,
                specializationName: profile.specialization?.name,
                university: profile.university?.name
            },
            listings: listings || [],
            purchases: purchases || []
        });

    } catch (error) {
        console.error('Dashboard Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
};

// 2. Update Profile Details
export const updateProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;

        // This accepts any field sent from the frontend (e.g., { bio: "New bio" } or { avatar_url: "..." })
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            message: 'Profile updated successfully!',
            userProfile: data
        });

    } catch (error) {
        console.error('Profile Update Error:', error);
        res.status(500).json({ error: 'Failed to update profile.' });
    }
};

// 3. Update User Avatar (with old file deletion)
export const updateAvatar = async (req, res) => {
    try {
        const { userId } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No image file provided.' });
        }

        // A. Fetch current profile to get the old avatar URL
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        if (userError) throw userError;

        // B. Delete the old avatar from storage if it exists
        if (user.avatar_url) {
            // Assuming your bucket is named 'avatars'
            // Extracts the filename from the end of the Supabase public URL
            const urlParts = user.avatar_url.split('/avatars/');
            if (urlParts.length > 1) {
                const oldFileName = urlParts[1];
                const { error: deleteError } = await supabase.storage
                    .from('avatars')
                    .remove([oldFileName]);

                if (deleteError) {
                    console.error('Failed to delete old avatar:', deleteError);
                    // We don't throw here so the user can still upload a new one even if deletion fails
                }
            }
        }

        // C. Upload the new avatar
        const fileExt = file.originalname.split('.').pop();
        const newFileName = `${userId}-${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(newFileName, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (uploadError) throw uploadError;

        // D. Get the new public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(newFileName);

        // E. Update the database record
        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', userId);

        if (updateError) throw updateError;

        res.status(200).json({
            message: 'Avatar updated successfully!',
            avatar_url: publicUrl
        });

    } catch (error) {
        console.error('Avatar Update Error:', error);
        res.status(500).json({ error: 'Failed to update avatar.' });
    }
};

// 4. Fetch Public Profile (Read-Only for other users)
export const getPublicProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const { user_id: visitorId } = req.query; // Who is viewing the profile?

        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select(`
                id, full_name, avatar_url, bio, qualification, year_of_study, created_at,
                course:courses(name),
                specialization:specializations(name),
                university:universities(name)
            `)
            .eq('id', userId)
            .single();

        if (profileError) throw profileError;

        const { data: listings, error: listingsError } = await supabase
            .from('products')
            .select('id, title, price, image_urls, created_at, views, likes_count, condition, status')
            .eq('seller_id', userId)
            .eq('status', 'available')
            .order('created_at', { ascending: false });

        if (listingsError) throw listingsError;

        // Attach Like/Save status if the visitor is logged in
        if (visitorId && listings.length > 0) {
            const productIds = listings.map(p => p.id);
            const [likesRes, savesRes] = await Promise.all([
                supabase.from('product_likes').select('product_id').eq('user_id', visitorId).in('product_id', productIds),
                supabase.from('product_saves').select('product_id').eq('user_id', visitorId).in('product_id', productIds)
            ]);

            const likedSet = new Set(likesRes.data?.map(l => l.product_id) || []);
            const savedSet = new Set(savesRes.data?.map(s => s.product_id) || []);

            listings.forEach(p => {
                p.is_liked = likedSet.has(p.id);
                p.is_saved = savedSet.has(p.id);
            });
        }

        res.status(200).json({
            profile: {
                ...profile,
                courseName: profile.course?.name,
                specializationName: profile.specialization?.name,
                university: profile.university?.name
            },
            listings: listings || []
        });

    } catch (error) {
        console.error('Public Profile Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch public profile.' });
    }
};