import { supabase } from '../../config/supabaseClient.js';

// 1. Request OTP
export const requestOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Extract the domain (e.g., from 'student@iiitk.ac.in' -> 'iiitk.ac.in')
        const domain = email.split('@')[1];
        if (!domain) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if the domain exists in our universities table
        const { data: university, error: uniError } = await supabase
            .from('universities')
            .select('id, name')
            .eq('domain', domain)
            .single();

        if (uniError || !university) {
            return res.status(403).json({ 
                error: 'Unauthorized Domain. Yahora is not yet available at your university.' 
            });
        }

        // If domain is valid, tell Supabase to send the OTP
        const { data, error } = await supabase.auth.signInWithOtp({
            email: email,
            options: {
                shouldCreateUser: true, // Creates the user in auth.users if they are new
            }
        });

        if (error) throw error;

        res.status(200).json({ 
            message: 'OTP sent successfully!', 
            university: university.name 
        });

    } catch (error) {
        console.error('OTP Request Error:', error);
        res.status(500).json({ error: 'Internal server error while sending OTP.' });
    }
};

// 2. Verify OTP
export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and OTP are required' });
        }

        // 1. Verify token with Supabase
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'email'
        });

        if (error) throw error;

        // 2. Extract domain and get university_id
        const domain = email.split('@')[1];
        const { data: university, error: uniError } = await supabase
            .from('universities')
            .select('id')
            .eq('domain', domain)
            .single();

        if (uniError || !university) throw new Error('University not found for this domain.');

        // 3. Check if user already exists in our public 'users' table
        let { data: publicUser, error: userFetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

        // 4. If they don't exist, this is their first time logging in. Create the base profile.
        if (!publicUser) {
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert([{ 
                    id: data.user.id, 
                    university_id: university.id,
                    is_profile_complete: false // Explicitly set to false
                }])
                .select()
                .single();

            if (insertError) throw insertError;
            publicUser = newUser;
        }

        // 5. Send response to frontend
        // Neeraj will check `userProfile.is_profile_complete`. 
        // If false, he routes them to /onboarding. If true, to /home.
        res.status(200).json({
            message: 'Authentication successful',
            session: data.session, 
            userAuth: data.user,
            userProfile: publicUser 
        });

    } catch (error) {
        console.error('OTP Verify Error:', error);
        res.status(500).json({ error: 'Internal server error while verifying OTP.' });
    }
};

// Onboarding Controller
// Inside backend/src/modules/auth/auth.controller.js

export const completeOnboarding = async (req, res) => {
    try {
        const { 
            userId, 
            full_name, 
            avatar_url, 
            qualification, 
            course_id, 
            year_of_study, 
            specialization_id, 
            bio 
        } = req.body;

        // 1. Validate the new mandatory fields
        if (!userId || !full_name || !qualification || !course_id || !year_of_study || !specialization_id) {
            return res.status(400).json({ 
                error: 'Missing required fields. Name, Qualification, Course, Year, and Specialization are mandatory.' 
            });
        }

        if (bio && bio.length > 250) {
            return res.status(400).json({ error: 'Bio must be 250 characters or less.' });
        }

        // 2. Update the user record in Supabase
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
                full_name,
                avatar_url: avatar_url || null,
                qualification, // Frontend string (e.g., 'Graduation')
                course_id,     // UUID from the database
                year_of_study, // Frontend string (e.g., '3rd year')
                specialization_id, // UUID from the database
                bio: bio || null,
                is_profile_complete: true
            })
            .eq('id', userId)
            .select()
            .single();

        if (updateError) throw updateError;

        res.status(200).json({
            message: 'Profile completed successfully!',
            userProfile: updatedUser
        });

    } catch (error) {
        console.error('Onboarding Error:', error);
        res.status(500).json({ error: 'Internal server error during onboarding.' });
    }
};

// 4. Demo Login (Interactive Sandbox)
export const demoLogin = async (req, res) => {
    try {
        // 1. Generate unique temporary credentials
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const demoEmail = `guest_${timestamp}_${randomStr}@demo.yahora.com`;
        const demoPassword = `Demo!${timestamp}${randomStr}`; 

        // 2. Fetch the Demo University ID
        const { data: university, error: uniError } = await supabase
            .from('universities')
            .select('id, name')
            .eq('domain', 'demo.yahora.com')
            .single();

        if (uniError || !university) {
            return res.status(500).json({ 
                error: 'Demo university not found. Please run the seed script first.' 
            });
        }

        // 3. Create the user using the Admin API (auto-confirms the email)
        const { data: authData, error: createError } = await supabase.auth.admin.createUser({
            email: demoEmail,
            password: demoPassword,
            email_confirm: true
        });

        if (createError) throw createError;

        // 4. Sign in immediately to generate a valid session token for the frontend
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPassword
        });

        if (signInError) throw signInError;

        // 5. Create their public profile
        // Notice we set is_profile_complete: false so they STILL see the onboarding screen!
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                id: signInData.user.id,
                university_id: university.id,
                is_profile_complete: false 
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        // 6. Return the exact same payload structure as verifyOtp
        res.status(200).json({
            message: 'Demo login successful',
            session: signInData.session,
            userAuth: signInData.user,
            userProfile: newUser
        });

    } catch (error) {
        console.error('Demo Login Error:', error);
        res.status(500).json({ error: 'Internal server error during demo login.' });
    }
};