// backend/scripts/seedDemo.js
/**
 * Yahora Demo Seed — Impressive showcase data for investors, VCs, industry experts & HR demos.
 *
 * Coverage:
 *  • 15 diverse verified-campus user personas
 *  • 40 marketplace listings across all 8 categories with all 5 conditions
 *  • created_at spread across "Today / This Week / This Month / Older" for full filter coverage
 *  • 25 community posts that read like real campus conversations
 *  • High views/likes on select items to populate the "Trending" sort
 *  • All category IDs match the Marketplace frontend filter keys exactly
 *
 * Run: node --experimental-vm-modules backend/scripts/seedDemo.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DEMO_DOMAIN   = 'demo.yahora.com';
const DEMO_UNI_NAME = 'Yahora University (Demo)';

/** Returns an ISO timestamp N days and H hours in the past */
const ago = (days = 0, hours = 0) =>
  new Date(Date.now() - days * 86_400_000 - hours * 3_600_000).toISOString();

// ─── 15 VERIFIED CAMPUS USER PERSONAS ────────────────────────────────────────
const DUMMY_USERS = [
  {
    email:  'rahul.sharma@demo.yahora.com',
    name:   'Rahul Sharma',
    role:   'B.Tech CSE — Final Year',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'priya.verma@demo.yahora.com',
    name:   'Priya Verma',
    role:   'MBA — 2nd Year',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'amit.gupta@demo.yahora.com',
    name:   'Amit Gupta',
    role:   'M.Tech Electronics — 1st Year',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'sarah.khan@demo.yahora.com',
    name:   'Sarah Khan',
    role:   'B.Des — 3rd Year',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'nikhil.bansal@demo.yahora.com',
    name:   'Nikhil Bansal',
    role:   'B.Tech AI & Data Science — 3rd Year',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'meera.joshi@demo.yahora.com',
    name:   'Meera Joshi',
    role:   'B.Tech ECE — 2nd Year',
    avatar: 'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'arjun.singh@demo.yahora.com',
    name:   'Arjun Singh',
    role:   'B.Tech IT — Final Year',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'ananya.roy@demo.yahora.com',
    name:   'Ananya Roy',
    role:   'B.Sc Mathematics — 3rd Year',
    avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'karthik.reddy@demo.yahora.com',
    name:   'Karthik Reddy',
    role:   'B.Tech Mechanical — 2nd Year',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'tanya.singh@demo.yahora.com',
    name:   'Tanya Singh',
    role:   'BBA — 3rd Year',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'rohan.patel@demo.yahora.com',
    name:   'Rohan Patel',
    role:   'B.Tech Civil Engineering — 1st Year',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'isha.malhotra@demo.yahora.com',
    name:   'Isha Malhotra',
    role:   'B.Tech CSE — 2nd Year',
    avatar: 'https://images.unsplash.com/photo-1491349174775-aaafddd81942?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'devika.nair@demo.yahora.com',
    name:   'Devika Nair',
    role:   'M.Sc Physics — 1st Year',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'siddharth.menon@demo.yahora.com',
    name:   'Siddharth Menon',
    role:   'B.Tech Electrical Engineering — Final Year',
    avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=150&q=80',
  },
  {
    email:  'zara.ali@demo.yahora.com',
    name:   'Zara Ali',
    role:   'B.Des Graphic Design — 2nd Year',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
  },
];

// ─── 40 MARKETPLACE LISTINGS ─────────────────────────────────────────────────
//
// category IDs must match Marketplace.jsx CATEGORIES exactly:
//   electronics | furniture | books | clothing | vehicles | appliances | sports | misc
//
// condition values must match Marketplace.jsx CONDITIONS exactly:
//   Mint | Like New | Good | Fair | Poor
//
// daysAgo / hoursAgo → drives created_at so every date filter has results:
//   Today  = daysAgo: 0
//   Week   = daysAgo: 1–6
//   Month  = daysAgo: 7–29
//   Older  = daysAgo: 30+
//
const DUMMY_PRODUCTS = [

  // ── ELECTRONICS (7 listings) ──────────────────────────────────────────────

  {
    title:    'MacBook Air M2 — Midnight (8GB / 256GB)',
    price:    52000,
    category: 'electronics',
    condition:'Mint',
    desc:     'Purchased last semester and barely used — battery health sits at 98%. Comes with original MagSafe charger, silicone sleeve, and retail box. No scratches, no dents. Ideal for developers, designers, and final-year project work. Genuine reason for selling: switching to a desktop setup.',
    imgs:     ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80'],
    location: 'CSE Department, 3rd Floor',
    views:    514,
    likes:    89,
    daysAgo:  0,
    hoursAgo: 3,
    status:   'available',
  },
  {
    title:    'Dell XPS 15 — i7 12th Gen, 16 GB RAM, 512 GB NVMe',
    price:    38000,
    category: 'electronics',
    condition:'Like New',
    desc:     'Premium ultrabook used for data-science coursework and ML experiments. NVIDIA GeForce GTX 1650, stunning 4K OLED display. Comes with original Dell bag, charger, and mouse. Moving abroad after final semester — must sell before May 30.',
    imgs:     ['https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80'],
    location: 'Boys Hostel Block A, Room 212',
    views:    391,
    likes:    66,
    daysAgo:  2,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Sony WH-1000XM5 Noise-Cancelling Headphones',
    price:    18500,
    category: 'electronics',
    condition:'Like New',
    desc:     'Industry-best active noise cancellation — perfect for library deep-focus sessions and late-night coding. Purchased 5 months ago. Battery life 30+ hours. Comes with original carrying case, USB-C cable, and 3.5 mm adapter.',
    imgs:     ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80'],
    location: 'Library Block, Reading Room',
    views:    278,
    likes:    54,
    daysAgo:  4,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Apple iPad Air 5th Gen (Wi-Fi, 64 GB) + Apple Pencil',
    price:    32000,
    category: 'electronics',
    condition:'Good',
    desc:     'Used extensively for digital note-taking, UI/UX wireframing, and digital art. Tiny scuff on the back; screen is flawless with no dead pixels. Includes a 1st-gen Apple Pencil (fully compatible) and smart folio cover.',
    imgs:     ['https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80'],
    location: 'Design Studio, Academic Block 2',
    views:    201,
    likes:    45,
    daysAgo:  6,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Samsung 24" FHD IPS Monitor — HDMI + VGA',
    price:    7500,
    category: 'electronics',
    condition:'Good',
    desc:     'Crisp IPS panel with excellent colour accuracy for coding and design work. No dead pixels, backlight is even. Includes original stand, power cable, and HDMI cable. Great dual-screen upgrade for your hostel room workstation.',
    imgs:     ['https://images.unsplash.com/photo-1527443224154-c4a573d5f5af?auto=format&fit=crop&w=800&q=80'],
    location: 'Academic Block 1, Lab 104',
    views:    136,
    likes:    31,
    daysAgo:  12,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'JBL Charge 5 Bluetooth Speaker — Waterproof',
    price:    9500,
    category: 'electronics',
    condition:'Like New',
    desc:     'Powerful portable speaker with 20+ hour battery and deep bass. Used only at a couple of campus fests — otherwise stored carefully. Waterproof rating IP67. Perfect for room parties, hostel common areas, or outdoor sessions.',
    imgs:     ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=80'],
    location: 'Hostel Block B, Common Room',
    views:    223,
    likes:    49,
    daysAgo:  9,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Logitech MX Keys Keyboard + MX Master 3 Mouse — Combo',
    price:    5500,
    category: 'electronics',
    condition:'Good',
    desc:     'The gold-standard productivity combo. MX Keys has backlighting and connects to 3 devices simultaneously. MX Master 3 features hyper-fast scroll and ergonomic shape. Used for 10 months; all keys responsive, no drift.',
    imgs:     ['https://images.unsplash.com/photo-1541140532154-b024d705b90a?auto=format&fit=crop&w=800&q=80'],
    location: 'CSE Lab, Block 3',
    views:    169,
    likes:    36,
    daysAgo:  22,
    hoursAgo: 0,
    status:   'available',
  },

  // ── FURNITURE (5 listings) ────────────────────────────────────────────────

  {
    title:    'Engineered Wood Study Table with Overhead Shelf',
    price:    2800,
    category: 'furniture',
    condition:'Good',
    desc:     'Spacious 4-foot study table with a fixed overhead shelf — extra space for textbooks, stationery, and your monitor. Minor scratch on one corner, structurally solid. Disassembles easily for transport. Perfect hostel room centrepiece.',
    imgs:     ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80'],
    location: 'Boys Hostel Block C, Room 108',
    views:    145,
    likes:    30,
    daysAgo:  0,
    hoursAgo: 5,
    status:   'available',
  },
  {
    title:    'Ergonomic High-Back Study Chair with Lumbar Support',
    price:    4200,
    category: 'furniture',
    condition:'Like New',
    desc:     'Used only for 6 months during a remote internship. Adjustable seat height, tilt tension, and 3D armrests. Makes a real difference in long study sessions and coding marathons. Pickup from Girls Hostel Block A.',
    imgs:     ['https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?auto=format&fit=crop&w=800&q=80'],
    location: 'Girls Hostel Block A, Room 215',
    views:    207,
    likes:    48,
    daysAgo:  3,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    '4-Tier Metal Bookshelf — Free-Standing',
    price:    1600,
    category: 'furniture',
    condition:'Good',
    desc:     'Holds 80+ books or binders comfortably. Some light rust on the base supports but frame is structurally sound and fully upright. Great for organising textbooks, lab files, and room décor. Fits in any hostel room corner.',
    imgs:     ['https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=800&q=80'],
    location: 'Hostel Block D, Room 302',
    views:    91,
    likes:    19,
    daysAgo:  14,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Single Bed Frame (Teak Wood) + Foam Mattress Bundle',
    price:    4500,
    category: 'furniture',
    condition:'Fair',
    desc:     'Solid teak bed frame with a 4-inch foam mattress. Mattress has minor stains (not visible under a bed sheet). Frame is fully sturdy with no wobble. Full PG-ready bundle. Price is negotiable for quick pickup.',
    imgs:     ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80'],
    location: 'Off-Campus PG, 5-min Walk from Main Gate',
    views:    114,
    likes:    21,
    daysAgo:  26,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Foldable Laptop Table — Height Adjustable (Bed / Floor)',
    price:    850,
    category: 'furniture',
    condition:'Mint',
    desc:     'Brand new condition — used only twice. Folds flat for storage under a cot. Height-adjustable legs with non-slip pads. Lightweight and easy to carry. Was gifted to me but I already have a desk setup.',
    imgs:     ['https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80'],
    location: 'Girls Hostel Block B, Room 112',
    views:    78,
    likes:    24,
    daysAgo:  40,
    hoursAgo: 0,
    status:   'available',
  },

  // ── BOOKS & STUDY MATERIALS (5 listings) ─────────────────────────────────

  {
    title:    'GATE CSE Complete Prep Bundle — 12 Books, 2025 Edition',
    price:    2200,
    category: 'books',
    condition:'Like New',
    desc:     'Full GATE-CS preparation set covering all 13 subjects. Includes Arihant theory books, Made Easy PYQ sets, and 3 mock-test booklets. Highlights in a few chapters only. Selling at under 60% of MRP. Perfect for 3rd-year students starting early.',
    imgs:     ['https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=800&q=80'],
    location: 'Library Café, Reading Room',
    views:    189,
    likes:    43,
    daysAgo:  0,
    hoursAgo: 6,
    status:   'available',
  },
  {
    title:    'OS (Galvin) + DBMS (Navathe) + CN (Forouzan) — Set of 3',
    price:    800,
    category: 'books',
    condition:'Good',
    desc:     'Core CSE 3rd-sem trio — essential for both campus placements and GATE. Pencil underlines throughout (easy to erase) and sticky-note summaries at chapter ends. Saves ₹1,800+ versus buying new.',
    imgs:     ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80'],
    location: 'CSE Department Notice Board Area',
    views:    131,
    likes:    26,
    daysAgo:  5,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'DSA Made Easy — Narasimha Karumanchi (Latest Edition)',
    price:    550,
    category: 'books',
    condition:'Good',
    desc:     'The placement bible. Fully annotated with interview tips in the margins. Helped me crack SDE rounds at Amazon and Flipkart. Passing it on to the next batch — carry the streak forward.',
    imgs:     ['https://images.unsplash.com/photo-1455885666463-6f8c6d3f7f8a?auto=format&fit=crop&w=800&q=80'],
    location: 'Hostel Block A, Common Area',
    views:    216,
    likes:    58,
    daysAgo:  7,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    '1st-Year Engineering Bundle — Physics, Maths, Chemistry (6 books)',
    price:    900,
    category: 'books',
    condition:'Fair',
    desc:     'Complete first-year science set for freshers. All pages intact; heavy highlighting and margin notes throughout — great for rapid revision. Save ₹2,200+ versus new. Ideal for anyone joining this semester.',
    imgs:     ['https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=800&q=80'],
    location: 'Academic Block 1, Near Reprographics',
    views:    97,
    likes:    20,
    daysAgo:  19,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Discrete Mathematics — Kenneth Rosen (Older Edition)',
    price:    180,
    category: 'books',
    condition:'Poor',
    desc:     'Cover is torn and spine is taped, but every single page is intact and readable. Content is identical to the newer edition. Perfect if you just need it for quick reference or exam prep. Essentially gifting it.',
    imgs:     ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80'],
    location: 'Hostel Block C, Room 401',
    views:    45,
    likes:    6,
    daysAgo:  55,
    hoursAgo: 0,
    status:   'available',
  },

  // ── CLOTHING & ACCESSORIES (5 listings) ───────────────────────────────────

  {
    title:    'Nike Dri-FIT Oversized Hoodie — Olive Green, Size L',
    price:    1400,
    category: 'clothing',
    condition:'Like New',
    desc:     'Worn twice to early morning classes. Super warm for cold exam-hall evenings. Machine-washed with colour-safe detergent. Fits true to a large. No pilling, no fading.',
    imgs:     ['https://images.unsplash.com/photo-1556821840-3a63f15732ce?auto=format&fit=crop&w=800&q=80'],
    location: 'Girls Hostel Block A, Room 310',
    views:    90,
    likes:    33,
    daysAgo:  0,
    hoursAgo: 2,
    status:   'available',
  },
  {
    title:    'Nike Air Max 270 Sneakers — Black, UK Size 9',
    price:    4500,
    category: 'clothing',
    condition:'Good',
    desc:     'Purchased 14 months ago and worn regularly but well-maintained. Soles are still thick and cushioning is intact. Minor scuff on the left toe-box. Great for campus walks, the sports complex, and casual outings.',
    imgs:     ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80'],
    location: 'Sports Complex Entrance',
    views:    158,
    likes:    41,
    daysAgo:  3,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Wildcraft 45 L Campus Backpack — Dark Grey',
    price:    1200,
    category: 'clothing',
    condition:'Good',
    desc:     'Heavy-duty pack with a padded 16" laptop compartment, separate organiser pocket, and side water-bottle pouches. Used for 2 semesters of daily commuting. All zippers smooth, straps firm. Great workhorse bag.',
    imgs:     ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80'],
    location: 'Main Gate, Near Parking Area',
    views:    104,
    likes:    24,
    daysAgo:  10,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Men\'s Formal Shirts — Set of 3 (White, Blue, Grey) — Size M',
    price:    950,
    category: 'clothing',
    condition:'Good',
    desc:     'Used only for campus placement drives and tech-fest presentations. Professionally ironed before listing. No stains, no tears. Perfect for interview season — one white, one sky-blue, one charcoal grey.',
    imgs:     ['https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80'],
    location: 'Boys Hostel Block B, Room 204',
    views:    73,
    likes:    16,
    daysAgo:  21,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Wrangler Denim Jacket — Unisex, Size M',
    price:    1800,
    category: 'clothing',
    condition:'Fair',
    desc:     'Classic washed-blue denim jacket with a slight natural fade and two vintage pin marks on the lapel. Gives any campus outfit an instant edge. Unisex cut fits both men and women wearing size M. Great for fests and outings.',
    imgs:     ['https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=800&q=80'],
    location: 'Cafeteria Area',
    views:    65,
    likes:    13,
    daysAgo:  38,
    hoursAgo: 0,
    status:   'available',
  },

  // ── VEHICLES & BIKES (4 listings) ─────────────────────────────────────────

  {
    title:    'Firefox Crossfire 21-Speed Mountain Bicycle',
    price:    6500,
    category: 'vehicles',
    condition:'Good',
    desc:     'The go-to campus commuter. All 21 gears shift smoothly, brakes replaced 2 months ago, tyres freshly inflated. Minor rust specks on the frame but nothing structural. A must-have for large campuses.',
    imgs:     ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80'],
    location: 'Cycle Stand, Boys Hostel',
    views:    304,
    likes:    73,
    daysAgo:  1,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Hero Lectro C3 Electric Cycle — Pedal-Assist, 35 km Range',
    price:    14000,
    category: 'vehicles',
    condition:'Like New',
    desc:     'Electric pedal-assist cycle in excellent condition. Fully charged, covers 35 km per charge. Purchased 8 months ago; used mainly for weekend trips. Perfect for students commuting 3–5 km from off-campus PGs.',
    imgs:     ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80'],
    location: 'Main Gate Parking',
    views:    243,
    likes:    60,
    daysAgo:  5,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Studds Full-Face Helmet — ISI Certified, Black, Size M',
    price:    900,
    category: 'vehicles',
    condition:'Good',
    desc:     'ISI certified and used for 1 year of daily scooty commuting. No cracks, no visible impact damage. Inner padding is clean and odour-free. Essential for riding electric scooties to and from campus.',
    imgs:     ['https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80'],
    location: 'Boys Hostel Block A Entrance',
    views:    90,
    likes:    18,
    daysAgo:  17,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Hercules MTB Bicycle + D-Lock + Rear Carrier — Bundle',
    price:    3200,
    category: 'vehicles',
    condition:'Fair',
    desc:     'Budget campus bike that gets the job done. Chain freshly oiled, tyres inflated, brakes adjusted. Front gear occasionally skips on the highest setting — a minor mechanical fix. Great-value bundle for campus errands.',
    imgs:     ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80'],
    location: 'Back Gate Cycle Shed',
    views:    66,
    likes:    11,
    daysAgo:  48,
    hoursAgo: 0,
    status:   'available',
  },

  // ── APPLIANCES (4 listings) ───────────────────────────────────────────────

  {
    title:    'Godrej 45 L Single-Door Mini Fridge — Hostel-Ready',
    price:    3500,
    category: 'appliances',
    condition:'Good',
    desc:     'Hostel-room lifesaver. Cools perfectly, defrosted and thoroughly cleaned before listing. No frost buildup or unusual noise. Ideal for medicines, beverages, and midnight snack storage. Moving out — must go ASAP.',
    imgs:     ['https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?auto=format&fit=crop&w=800&q=80'],
    location: 'Boys Hostel Block B, Room 116',
    views:    200,
    likes:    46,
    daysAgo:  0,
    hoursAgo: 4,
    status:   'available',
  },
  {
    title:    'Bajaj 1.7 L Electric Kettle + 4-Socket Extension Board — Combo',
    price:    750,
    category: 'appliances',
    condition:'Good',
    desc:     'The ideal fresher combo. Kettle boils a full litre in under 4 minutes. Extension board has surge protection and 4 sockets + 2 USB ports. Both fully functional. Great starter kit at a budget price.',
    imgs:     ['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80'],
    location: 'Girls Hostel Block C, Room 208',
    views:    124,
    likes:    29,
    daysAgo:  8,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Orient 3-Speed Table Fan — 400 mm, Oscillating',
    price:    1200,
    category: 'appliances',
    condition:'Good',
    desc:     'All three speed settings work perfectly. Oscillation mechanism is smooth. Freshly cleaned grills. An absolute necessity during April–June exams when the AC doesn\'t cool the far corners of the room.',
    imgs:     ['https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80'],
    location: 'Hostel Block A, Room 305',
    views:    78,
    likes:    14,
    daysAgo:  18,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Philips Dry Iron + Usha Room Heater — Winter Bundle',
    price:    800,
    category: 'appliances',
    condition:'Fair',
    desc:     'Iron works perfectly with full temperature range. Heater has a hairline crack on the outer shell but the heating element is 100% functional and safe. Useful bundle for winter-semester hostel setups. Negotiable.',
    imgs:     ['https://images.unsplash.com/photo-1615224143859-5b0b4f1f80cb?auto=format&fit=crop&w=800&q=80'],
    location: 'Hostel Block D, Room 501',
    views:    50,
    likes:    8,
    daysAgo:  45,
    hoursAgo: 0,
    status:   'available',
  },

  // ── SPORTS & FITNESS (5 listings) ─────────────────────────────────────────

  {
    title:    'SG RSD Spark Cricket Bat + Batting Gloves + Pads — Full Kit',
    price:    4200,
    category: 'sports',
    condition:'Good',
    desc:     'Complete campus cricket setup. Bat has 3 knocks done and good pick-up. Batting gloves and pads are lightly used and clean. Ready to play on Day 1. Great for weekend afternoon matches at the campus ground.',
    imgs:     ['https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=800&q=80'],
    location: 'Sports Complex, Cricket Ground Side',
    views:    136,
    likes:    31,
    daysAgo:  2,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Yonex Arcsaber 7 Pro Badminton Rackets — Pair',
    price:    2800,
    category: 'sports',
    condition:'Like New',
    desc:     'Both rackets re-strung just 5 weeks ago with Yonex BG-65 string. Excellent for intermediate–competitive play on the campus indoor court. Comes with a padded dual-racket carry bag. Used by a badminton club member.',
    imgs:     ['https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80'],
    location: 'Badminton Court, Sports Complex',
    views:    119,
    likes:    27,
    daysAgo:  11,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Anti-Slip Yoga Mat (6 mm) + 3 Resistance Bands — Set',
    price:    950,
    category: 'sports',
    condition:'Mint',
    desc:     'Bought during mid-semester stress, used 4–5 times. Mat has carry strap and is non-slip on both sides. All three resistance bands are still in their original sealed packaging. Perfect for a hostel-room wellness routine.',
    imgs:     ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80'],
    location: 'Girls Hostel Block B, Terrace',
    views:    95,
    likes:    23,
    daysAgo:  23,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Adjustable Cast-Iron Dumbbell Set — 5 kg to 20 kg (8 Plates)',
    price:    3200,
    category: 'sports',
    condition:'Good',
    desc:     'Rubber-coated cast-iron plates with adjustable handles. Used regularly for 8 months. No chips, no rust — properly stored. Perfect for a compact hostel-room gym. Pickup only; cannot ship due to weight.',
    imgs:     ['https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80'],
    location: 'Boys Hostel Block A, Gym Room',
    views:    158,
    likes:    39,
    daysAgo:  30,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Nivia Football (Size 5) + Adidas Shin Guards — Combo',
    price:    750,
    category: 'sports',
    condition:'Fair',
    desc:     'Football holds air perfectly after re-inflation but shows good match wear. Shin guards are barely used and snug. Great combo for Sunday evening ground sessions near the back gate.',
    imgs:     ['https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80'],
    location: 'Football Ground, Near Back Gate',
    views:    60,
    likes:    12,
    daysAgo:  60,
    hoursAgo: 0,
    status:   'available',
  },

  // ── MISCELLANEOUS (5 listings) ────────────────────────────────────────────

  {
    title:    'Yamaha F310 Acoustic Guitar + Padded Bag + Clip-On Tuner',
    price:    5500,
    category: 'misc',
    condition:'Good',
    desc:     'Bought in first year; performed at two campus open-mics and the annual cultural fest. All strings intact, tuning pegs smooth. Comes with a zippered padded carry bag and a chromatic clip-on tuner. A wonderful starter guitar.',
    imgs:     ['https://images.unsplash.com/photo-1550226891-ef816aed4a98?auto=format&fit=crop&w=800&q=80'],
    location: 'Music Room, Cultural Block',
    views:    269,
    likes:    63,
    daysAgo:  1,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Canon EOS 200D DSLR + 18–55 mm Kit Lens — Full Kit',
    price:    28000,
    category: 'misc',
    condition:'Good',
    desc:     'Captured hundreds of campus events, fests, and graduation shoots. Shutter count ~8,000 (very low). Sensor clean; lens has no scratches or fungus. Includes 2 batteries, 32 GB SD card, and a semi-hard carry bag.',
    imgs:     ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80'],
    location: 'Photography Club Room, Block 4',
    views:    314,
    likes:    71,
    daysAgo:  3,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Wacom Intuos Small Graphics Tablet + 3 Replacement Nibs',
    price:    3500,
    category: 'misc',
    condition:'Mint',
    desc:     'Perfect for UI/UX prototyping, digital illustration, and online whiteboarding. Comes with original nib kit and USB cable. Used 5–6 times before switching to an iPad Pro. Compatible with all major design software.',
    imgs:     ['https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80'],
    location: 'Design Studio, Academic Block 2',
    views:    147,
    likes:    35,
    daysAgo:  15,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'LED Desk Lamp (USB Charging Port, 3 Modes) + Casio Digital Watch',
    price:    800,
    category: 'misc',
    condition:'Good',
    desc:     'Flexible-neck lamp with warm / cool / daylight modes and a built-in USB port to charge your phone while studying. Casio watch has date, alarm, and stopwatch functions. Both work perfectly — bundled as a fresher starter pack.',
    imgs:     ['https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80'],
    location: 'Boys Hostel Block C, Room 307',
    views:    89,
    likes:    17,
    daysAgo:  27,
    hoursAgo: 0,
    status:   'available',
  },
  {
    title:    'Magnetic Whiteboard (2×1.5 ft) + 5 Markers + Duster',
    price:    500,
    category: 'misc',
    condition:'Fair',
    desc:     'Slight ghost marks that don\'t fully erase but don\'t interfere with daily use. Comes with 5 coloured markers (4 fully working), a duster, and wall-mounting hardware. Excellent for study schedules, to-do lists, and revision mind maps.',
    imgs:     ['https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=800&q=80'],
    location: 'Hostel Block A, Room 109',
    views:    54,
    likes:    9,
    daysAgo:  65,
    hoursAgo: 0,
    status:   'available',
  },
];

// ─── 25 COMMUNITY POSTS ───────────────────────────────────────────────────────
// Written to feel like authentic campus conversations that showcase Yahora's value.
const DUMMY_POSTS = [
  { content: 'Sold my old bicycle in under 2 hours on Yahora. The buyer was literally in the hostel block next to mine 🚴 This is how campus selling is supposed to work.', daysAgo: 0, hoursAgo: 1 },
  { content: 'MacBook deal done at the library gate. He showed his student ID, I checked the product, we did UPI, and it was done in 10 minutes. Zero anxiety, zero scammers ✅', daysAgo: 0, hoursAgo: 4 },
  { content: 'MOVE-OUT ALERT 📦 Selling study table, ergonomic chair, mini fridge, and table fan before semester ends. Hostel Block B, Room 204. Pickup this Saturday. DM me here.', daysAgo: 0, hoursAgo: 7 },
  { content: 'Freshers tip nobody tells you: buy your textbooks on Yahora. Saved ₹2,200 this semester buying second-hand from seniors. Same content, fraction of the price 📚', daysAgo: 1, hoursAgo: 0 },
  { content: 'PSA: semester end is 3 weeks away. List your hostel furniture NOW before the market floods. Early sellers consistently get 20–30% better prices than last-minute ones 🪑', daysAgo: 1, hoursAgo: 5 },
  { content: 'The swipe discovery mode is literally Tinder for campus stuff and I am absolutely here for it 😂 Liked 12 items in under 5 minutes without knowing what I was looking for.', daysAgo: 2, hoursAgo: 0 },
  { content: 'Got my full GATE prep bundle at 55% off from a senior who just cracked it with AIR 47. The trust factor of buying from a verified campus student is genuinely unmatched 🙌', daysAgo: 2, hoursAgo: 8 },
  { content: 'Tip for sellers: upload multiple photos and be upfront about the condition. My listing with 4 photos got 3× more DMs than my single-photo ones. Transparency = faster sales.', daysAgo: 3, hoursAgo: 0 },
  { content: 'Anyone selling an electric kettle near Block C? The hostel mess is closed for renovation and I am surviving on Maggi and sheer desperation ☕😭', daysAgo: 3, hoursAgo: 6 },
  { content: 'Set up my entire hostel room — study table, ergonomic chair, lamp, and mini fridge — for under ₹5,000 total using Yahora. My parents asked how I managed so well on a budget 😄', daysAgo: 4, hoursAgo: 0 },
  { content: '"Hot at Campus" surfaced my classmate\'s Canon DSLR listing before I even searched for it. The campus-specific algorithm genuinely knows what students here need 📸', daysAgo: 4, hoursAgo: 9 },
  { content: 'Anyone selling a white lab coat in size M or L? Need it urgently for tomorrow\'s chemistry practical. Can pick up tonight from anywhere on campus 🧪', daysAgo: 5, hoursAgo: 0 },
  { content: 'Listed 4 items before breakfast and had 3 interested buyers by lunch. The engagement density of a closed campus network is something general marketplaces simply cannot replicate.', daysAgo: 5, hoursAgo: 11 },
  { content: 'Freshers: this is NOT Facebook Marketplace. Every single person here is a verified student from YOUR campus. No catfishing, no strangers, no fake accounts. Sleep peacefully 💯', daysAgo: 6, hoursAgo: 0 },
  { content: 'Selling CSE 3rd-sem complete book bundle this Sunday. Used once for mid-sems. Margin notes included free 😅 DM before Sunday morning or they are gone.', daysAgo: 7, hoursAgo: 0 },
  { content: 'Swipe mode is perfect for hostel boredom at 11 PM. Found a Yamaha acoustic guitar I had no idea I needed until I swiped right on it. Now I play badly but happily 🎸', daysAgo: 9, hoursAgo: 0 },
  { content: 'Ergonomic chair for ₹4,200 when the exact same model costs ₹11,000 on Amazon. Campus circular economy is genuinely one of the best financial decisions you can make 💺', daysAgo: 12, hoursAgo: 0 },
  { content: 'Final year here. Listed 9 items across three months before graduation. Sold 7 of them. Yahora essentially funded my farewell dinner and covered my first month\'s deposit 🎓', daysAgo: 14, hoursAgo: 0 },
  { content: 'The in-app DM makes price negotiation feel natural and private. No awkward WhatsApp groups, no public bidding. Just clean, one-on-one campus commerce. Exactly right.', daysAgo: 16, hoursAgo: 0 },
  { content: 'Looking for a Yonex badminton racket or a shuttle tube. Budget ₹1,500. I am at the sports complex most evenings. DM if you have one to sell 🏸', daysAgo: 18, hoursAgo: 0 },
  { content: 'Quick reminder: mark your item as Sold once the deal closes. Keeps listings accurate, builds trust, and helps other buyers stop chasing things that are already gone ✔️', daysAgo: 21, hoursAgo: 0 },
  { content: 'Been on Yahora for 3 weeks. Already bought a cycle, sold my old monitor, and saved ₹3,800 on textbooks. This thing is quietly becoming an essential campus utility.', daysAgo: 24, hoursAgo: 0 },
  { content: 'Move-out week every May is the absolute best time to buy furniture. Seniors practically gift things at 70% off because they cannot take them home. Set your notifications now 📲', daysAgo: 28, hoursAgo: 0 },
  { content: 'Bought a MacBook Air M2 from a final-year student through Yahora — ₹72K versus ₹1.15 lakh new. Battery health 98%. The verified-student layer gave me the confidence to make that call 💻', daysAgo: 32, hoursAgo: 0 },
  { content: 'Campus-verified access = zero scammers by design. This single feature makes Yahora 10× safer than any open marketplace. Every college in India deserves something like this 🏫', daysAgo: 40, hoursAgo: 0 },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function maybeSingle(query) {
  const { data, error } = await query.maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function getAuthUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data?.users?.find((u) => u.email === email) ?? null;
}

async function getOrCreateAuthUser(user) {
  const existing = await getAuthUserByEmail(user.email);
  if (existing) return existing;

  const { data, error } = await supabase.auth.admin.createUser({
    email:         user.email,
    password:      'Password123!',
    email_confirm: true,
    user_metadata: { full_name: user.name },
  });

  if (error) {
    if (
      error.message?.toLowerCase().includes('already registered') ||
      error.message?.toLowerCase().includes('already exists')
    ) {
      return await getAuthUserByEmail(user.email);
    }
    throw error;
  }
  return data.user;
}

// ─── MAIN SEED ────────────────────────────────────────────────────────────────

async function seedSandbox() {
  console.log('🌱  Starting Yahora demo seed...\n');

  try {
    // ── University ────────────────────────────────────────────────────────────
    const uniData = await maybeSingle(
      supabase.from('universities').select('id').eq('domain', DEMO_DOMAIN)
    );
    let demoUniId = uniData?.id;

    if (!demoUniId) {
      console.log('🏫  Creating demo university...');
      const { data: newUni, error: uniErr } = await supabase
        .from('universities')
        .insert([{ name: DEMO_UNI_NAME, domain: DEMO_DOMAIN }])
        .select('id')
        .single();
      if (uniErr) throw uniErr;
      demoUniId = newUni.id;
      console.log(`✅  University created: ${DEMO_UNI_NAME} (id: ${demoUniId})\n`);
    } else {
      console.log(`✅  Demo university already exists (id: ${demoUniId})\n`);
    }

    // ── Users ─────────────────────────────────────────────────────────────────
    const userIds = [];
    console.log(`👥  Seeding ${DUMMY_USERS.length} campus user personas...`);

    for (const u of DUMMY_USERS) {
      const authUser = await getOrCreateAuthUser(u);
      if (!authUser?.id) continue;

      const { error: profileErr } = await supabase.from('users').upsert(
        {
          id:                  authUser.id,
          university_id:       demoUniId,
          full_name:           u.name,
          avatar_url:          u.avatar,
          qualification:       u.role,
          bio:                 `${u.role} · Trading on Yahora`,
          is_profile_complete: true,
        },
        { onConflict: 'id' }
      );
      if (profileErr) throw profileErr;

      userIds.push(authUser.id);
      console.log(`   ✓ ${u.name} (${u.role})`);
    }

    // ── Products ──────────────────────────────────────────────────────────────
    console.log(`\n🛍️   Seeding ${DUMMY_PRODUCTS.length} marketplace listings...`);

    const categoryCounts = {};
    const conditionCounts = {};

    for (let i = 0; i < DUMMY_PRODUCTS.length; i++) {
      const p = DUMMY_PRODUCTS[i];
      const sellerId = userIds[i % userIds.length];

      // Track coverage for the summary
      categoryCounts[p.category]  = (categoryCounts[p.category]  || 0) + 1;
      conditionCounts[p.condition] = (conditionCounts[p.condition] || 0) + 1;

      const exists = await maybeSingle(
        supabase.from('products').select('id').eq('title', p.title)
      );

      if (!exists) {
        const { error: prodErr } = await supabase.from('products').insert([{
          seller_id:     sellerId,
          university_id: demoUniId,
          title:         p.title,
          description:   p.desc,
          price:         p.price,
          category:      p.category,
          condition:     p.condition,
          image_urls:    p.imgs,
          status:        p.status,
          location:      p.location,
          views:         p.views,
          likes_count:   p.likes,
          created_at:    ago(p.daysAgo, p.hoursAgo),
        }]);
        if (prodErr) throw prodErr;
        console.log(`   ✓ [${p.category}] ${p.title} — ₹${p.price.toLocaleString('en-IN')} · ${p.condition}`);
      } else {
        console.log(`   ↩ Already exists: ${p.title}`);
      }
    }

    // ── Posts ─────────────────────────────────────────────────────────────────
    console.log(`\n💬  Seeding ${DUMMY_POSTS.length} community posts...`);

    for (let i = 0; i < DUMMY_POSTS.length; i++) {
      const post     = DUMMY_POSTS[i];
      const authorId = userIds[(i + 2) % userIds.length];

      const exists = await maybeSingle(
        supabase.from('posts').select('id').eq('content', post.content)
      );

      if (!exists) {
        const { error: postErr } = await supabase.from('posts').insert([{
          author_id:     authorId,
          university_id: demoUniId,
          content:       post.content,
          created_at:    ago(post.daysAgo, post.hoursAgo),
        }]);
        if (postErr) throw postErr;
        console.log(`   ✓ Post ${i + 1}: "${post.content.slice(0, 60)}..."`);
      } else {
        console.log(`   ↩ Already exists (post ${i + 1})`);
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(60));
    console.log('🎉  Yahora demo seed completed successfully!\n');
    console.log(`   University  : ${DEMO_UNI_NAME}`);
    console.log(`   Domain      : ${DEMO_DOMAIN}`);
    console.log(`   Users       : ${DUMMY_USERS.length}`);
    console.log(`   Products    : ${DUMMY_PRODUCTS.length}`);
    console.log(`   Posts       : ${DUMMY_POSTS.length}`);

    console.log('\n   Category breakdown:');
    for (const [cat, count] of Object.entries(categoryCounts)) {
      console.log(`     ${cat.padEnd(14)} → ${count} listing(s)`);
    }

    console.log('\n   Condition breakdown:');
    for (const [cond, count] of Object.entries(conditionCounts)) {
      console.log(`     ${cond.padEnd(10)} → ${count} listing(s)`);
    }

    console.log('\n   Date filter coverage:');
    const today = DUMMY_PRODUCTS.filter(p => p.daysAgo === 0).length;
    const week  = DUMMY_PRODUCTS.filter(p => p.daysAgo >= 1 && p.daysAgo <= 6).length;
    const month = DUMMY_PRODUCTS.filter(p => p.daysAgo >= 7 && p.daysAgo <= 29).length;
    const older = DUMMY_PRODUCTS.filter(p => p.daysAgo >= 30).length;
    console.log(`     Today       → ${today} listing(s)`);
    console.log(`     This Week   → ${week} listing(s)`);
    console.log(`     This Month  → ${month} listing(s)`);
    console.log(`     Older       → ${older} listing(s)`);
    console.log('─'.repeat(60) + '\n');

  } catch (err) {
    console.error('\n❌  Seeding error:', err.message);
    if (err.details) console.error('   Details:', err.details);
    if (err.hint)    console.error('   Hint:',    err.hint);
    if (err.code)    console.error('   Code:',    err.code);
    process.exit(1);
  }
}

seedSandbox();