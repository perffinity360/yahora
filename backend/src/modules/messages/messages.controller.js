// backend/src/modules/messages/messages.controller.js
import { supabase } from '../../config/supabaseClient.js';

// 1. Get the Inbox Summary (Calls our new RPC)
export const getInbox = async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase.rpc('get_user_inbox', {
            p_user_id: userId
        });

        if (error) throw error;

        res.status(200).json({ inbox: data || [] });
    } catch (error) {
        console.error('Get Inbox Error:', error);
        res.status(500).json({ error: 'Failed to fetch inbox.' });
    }
};

// 2. Get Chat History (Between two specific users for a specific product)
export const getChatHistory = async (req, res) => {
    try {
        const { userId, contactId, productId } = req.query;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('product_id', productId)
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: true }); // Oldest first for chat UI

        if (error) throw error;

        res.status(200).json({ messages: data || [] });
    } catch (error) {
        console.error('Get Chat History Error:', error);
        res.status(500).json({ error: 'Failed to fetch messages.' });
    }
};

// 3. Send a Message
export const sendMessage = async (req, res) => {
    try {
        const { sender_id, receiver_id, product_id, content } = req.body;

        // Fetch university_id to strictly enforce campus isolation
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('university_id')
            .eq('id', sender_id)
            .single();

        if (userError || !user) throw new Error('User not found.');

        const { data: message, error } = await supabase
            .from('messages')
            .insert([{
                sender_id,
                receiver_id,
                product_id,
                university_id: user.university_id,
                content,
                is_read: false
            }])
            .select()
            .single();

        if (error) throw error;

        // Immediately return success to the sender
        res.status(201).json({ message });

        /* HE DEMO AUTO-RESPONDER BOT */
        try {
            // Check if this interaction is happening in the Demo Campus
            const { data: uni } = await supabase
                .from('universities')
                .select('domain')
                .eq('id', user.university_id)
                .single();

            if (uni?.domain === 'demo.yahora.com') {
                // Fetch the receiver's name to personalize the bot response
                const { data: receiver } = await supabase
                    .from('users')
                    .select('full_name')
                    .eq('id', receiver_id)
                    .single();

                if (receiver) {
                    const firstName = receiver?.full_name?.split(' ')[0] || 'Student';

                    // A list of smart responses to make it feel natural
                    const botResponses = [
  `Hey! ${firstName} here — well, sort of. I'm the auto-responder standing in while the real ${firstName} is probably buried under assignments. In the actual app, I'd be a real student ready to close this deal! 👋`,
  `${firstName} (bot edition) speaking 🤖. Real talk — the actual ${firstName} has no idea you just messaged them. But I do, and I think you have great taste for checking out this listing.`,
  `Okay okay, I'll come clean. I'm not really ${firstName}. I'm a bot with ${firstName}'s name badge and absolutely none of their charm. But hey, the messaging feature works flawlessly, doesn't it? ⚡`,
  `*${firstName} is typing...* — Nah, just kidding. It's the bot again. But in ${firstName}'s defence, they'd probably have replied with "still available, bro. come to hostel B." 🏠`,
  `${firstName} would want me to tell you: yes, the item is in great condition, the price is negotiable, and they're free after 5 PM near the canteen. (This is entirely made up. But very realistic, right?) 😄`,
  `Plot twist — ${firstName} didn't list this at 2 AM during a spontaneous hostel room cleanout. Or did they? 🌙 Either way, on real Yahora this reply would've come from the actual ${firstName} in seconds.`,
  `Hi! Bot-${firstName} here with a fun fact: this message just traveled through Yahora Realtime, hit the server, triggered an auto-responder, and landed in your chat — all in under 3 seconds. ${firstName} could never. 🚀`,
  `${firstName}'s out-of-office bot response: "Thanks for your message! I'm currently in a lecture pretending to take notes. Please leave a bid and I'll get back to you after the professor stops looking." 📝`,
  `Genuinely cannot stress this enough — the real ${firstName} is a verified student on a real campus. No random strangers. No scammers. Just broke college kids selling stuff they no longer need. That's the Yahora difference. 🎓`,
  `${firstName}'s bot here, filing an official complaint: I've been answering messages all day and nobody has offered me a coffee. The canteen is literally 200 metres away. Just saying. ☕`,
  `Alright, that's a wrap on the demo! The real ${firstName} is out there somewhere on campus, waiting to make their first Yahora sale. Go sign up with your university email and make it happen. Keep the story going. 🛍️✨`,
];
                    const randomReply = botResponses[Math.floor(Math.random() * botResponses.length)];

                    // Wait 3 seconds, then programmatically insert the bot's reply
                    setTimeout(async () => {
                        await supabase.from('messages').insert([{
                            sender_id: receiver_id,   // Bot acts as the sender
                            receiver_id: sender_id,   // VC is the receiver
                            product_id,
                            university_id: user.university_id,
                            content: randomReply,
                            is_read: false
                        }]);
                    }, 3000);
                }
            }
        } catch (botErr) {
            console.error('Bot Auto-Responder Error:', botErr);
        }
        /* ======================================================== */

    } catch (error) {
        console.error('Send Message Error:', error);
        res.status(500).json({ error: 'Failed to send message.' });
    }
};

// 4. Mark Messages as Read
export const markAsRead = async (req, res) => {
    try {
        const { userId, contactId, productId } = req.body;
        const { error } = await supabase
            .from('messages')
            .update({ is_read: true, is_delivered: true }) // <-- added is_delivered: true
            .eq('receiver_id', userId)
            .eq('sender_id', contactId)
            .eq('product_id', productId)
            .eq('is_read', false);

        if (error) throw error;
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Mark as Read Error:', error);
        res.status(500).json({ error: 'Failed to update read status.' });
    }
};

export const markAsDelivered = async (req, res) => {
    try {
        const { userId } = req.body;
        // Marks all messages sent TO this user as delivered (because they just opened the app)
        const { error } = await supabase
            .from('messages')
            .update({ is_delivered: true })
            .eq('receiver_id', userId)
            .eq('is_delivered', false);

        if (error) throw error;
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Mark as Delivered Error:', error);
        res.status(500).json({ error: 'Failed to update delivery status.' });
    }
};