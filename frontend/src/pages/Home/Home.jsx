// frontend\src\pages\Home\Home.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom"; // Added useNavigate for the product card
import UniversityModal from "../../components/modal/UniversityModal";
import { useAuth } from "../../contexts/AuthContext";
import ProductCard from "../../components/ProductCard/ProductCard";
// Import the elegant line icons from lucide-react
import {
  ShieldCheck,
  ShoppingBag,
  Handshake,
  MapPin,
  Package,
  UserCheck,
  Shield,
  MailCheck,
  UserX,
  Heart,
  MessageCircle,
  Sparkles,
  Rocket,
  MonitorPlay,
  X,
} from "lucide-react";
import styles from "./Home.module.css";
// --- MOCK DATA FOR UI DEVELOPMENT ---
// [Keep all your existing MOCK_BUZZ and MOCK_LISTINGS data exactly the same here]
const MOCK_BUZZ = [
  {
    id: 1,
    name: "Neeraj Kumar",
    time: "2 mins ago",
    location: "Hall 2",
    content: "Anyone heading to the city this evening? Looking to carpool! 🚗",
    likes: 12,
    comments: 4,
    avatar: "https://i.pravatar.cc/150?img=11",
  },
  {
    id: 2,
    name: "Shivani Singh",
    time: "15 mins ago",
    location: "Hall 1",
    content:
      "Selling my mini-fridge, dm if interested! Moving out by Saturday. ❄️",
    likes: 8,
    comments: 2,
    avatar: "https://i.pravatar.cc/150?img=5",
  },
  {
    id: 3,
    name: "Vishwajeet Singh",
    time: "1 hour ago",
    location: "Hall 3",
    content:
      "Found a pair of RayBans near the Mess. Please message me if they are yours!",
    likes: 24,
    comments: 11,
    avatar: "https://i.pravatar.cc/150?img=8",
  },
  {
    id: 4,
    name: "Shivangi Singh",
    time: "5 mins ago",
    location: "Hall 4",
    content:
      "Anyone has DSA notes for placements? Especially graphs & DP. Would really appreciate it 🙏",
    likes: 16,
    comments: 6,
    avatar: "https://i.pravatar.cc/150?img=9",
  },
];
const MOCK_LISTINGS = [
  {
    id: "mock-1",
    title: "Sony WH-1000XM4 Headphones",
    price: 5000,
    description: "Used for a few months, excellent noise cancellation.",
    image_urls: [
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&q=80&w=800",
    ],
    condition: "Mint",
    location: "Hall 1",
    status: "available",
    views: 124,
    likes_count: 12,
    comments_count: 3,
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    is_liked: false,
    is_saved: false,
    seller: {
      id: "user-1",
      full_name: "Anmol Singh",
      avatar_url: "https://i.pravatar.cc/150?img=11",
      university: "IIITDM Kurnool",
    },
  },
  {
    id: "mock-2",
    title: "Keychron K2 Mechanical Keyboard",
    price: 3000,
    description: "Brown switches, wireless. Works perfectly.",
    image_urls: [
      "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&q=80&w=800",
    ],
    condition: "Like New",
    location: "Hall 3",
    status: "available",
    views: 89,
    likes_count: 8,
    comments_count: 1,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    is_liked: true,
    is_saved: false,
    seller: {
      id: "user-2",
      full_name: "Gyanendra Srivastava",
      avatar_url: "https://i.pravatar.cc/150?img=12",
      university: "IIITDM Kurnool",
    },
  },
  {
    id: "mock-3",
    title: "IKEA Study Table + Chair Set",
    price: 1100,
    description: "Moving out sale. Must pick up by Sunday.",
    image_urls: [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&q=80&w=800",
    ],
    condition: "Good",
    location: "Hall 2",
    status: "sold",
    views: 250,
    likes_count: 34,
    comments_count: 8,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    is_liked: false,
    is_saved: true,
    seller: {
      id: "user-3",
      full_name: "Dikhsha Prajapati",
      avatar_url: "https://i.pravatar.cc/150?img=5",
      university: "NIET Greater Noida",
    },
  },
  {
    id: "mock-4",
    title: "Hero Sprint Pro Bicycle",
    price: 1800,
    description: "Great for getting around campus quickly. Recently serviced.",
    image_urls: [
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&q=80&w=800",
    ],
    condition: "Fair",
    location: "Hall 4",
    status: "available",
    views: 56,
    likes_count: 5,
    comments_count: 0,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    is_liked: false,
    is_saved: false,
    seller: {
      id: "user-4",
      full_name: "Sanya",
      avatar_url: "https://i.pravatar.cc/150?img=9",
      university: "NIET Greater Noida",
    },
  },
];
// --- TAGLINES ARRAY ---
const TAGLINES = [
  "Because Every Item Has a Memory.",
  "Where Every Thing Finds Its Next Story.",
  "Keep the Story Going.",
];
const Home = () => {
  const [likedPosts, setLikedPosts] = useState({});
  const videoRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDemoOptions, setShowDemoOptions] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const { isAuthenticated, login } = useAuth();
  const currentUserId = localStorage.getItem("yahora_user_id");
  const navigate = useNavigate();

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/demo-login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("yahora_demo_user", "true");
        if (data.userProfile?.university_id) {
          localStorage.setItem(
            "yahora_university_id",
            data.userProfile.university_id,
          );
        }
        const userId = data.userProfile?.id || data.userAuth?.id;
        if (userId) login(data.session.access_token, userId);
        navigate("/onboarding");
      }
    } catch (error) {
      console.error("Demo login failed:", error);
    } finally {
      setDemoLoading(false);
    }
  };
  // --- TYPEWRITER STATES ---
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(100);
  // --- TYPEWRITER LOGIC ---
  useEffect(() => {
    const handleType = () => {
      const i = loopNum % TAGLINES.length;
      const fullText = TAGLINES[i];
      // Determine next text state
      setText(
        isDeleting
          ? fullText.substring(0, text.length - 1)
          : fullText.substring(0, text.length + 1),
      );
      // Adjust typing speed (delete faster)
      setTypingSpeed(isDeleting ? 40 : 100);
      // If word is complete, wait and start deleting
      if (!isDeleting && text === fullText) {
        setTimeout(() => setIsDeleting(true), 2500); // 2.5 second pause reading time
      }
      // If deleted completely, move to next word
      else if (isDeleting && text === "") {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
        setTypingSpeed(500); // Pause before typing new sentence
      }
    };
    const timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, loopNum, typingSpeed]);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.65;
    }
  }, []);
  return (
    <>
      <div className={styles.homeContainer}>
        {/* 1. HERO SECTION */}
        <section className={styles.heroSection}>
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            className={styles.heroVideo}
            src="https://iwhtzhejyhaqctoqsolz.supabase.co/storage/v1/object/public/yahora%20videos/yahora_home_page.mp4"
          />
          <div className={styles.heroOverlay}>
            <div className={styles.heroContent}>
              <span className={styles.heroBadge}>
                Buy and sell within your campus.
              </span>
              {/* UPDATED TITLE WITH TYPEWRITER */}
              <h1 className={styles.heroTitle} style={{ minHeight: "120px" }}>
                {text}
                <span className={styles.typewriterCursor}>|</span>
              </h1>
              <div className={styles.heroButtons}>
                <button
                  className={styles.btnSecondary}
                  onClick={() => setIsModalOpen(true)}
                >
                  View Supported Campuses
                </button>

                {/* --- NEW ANIMATED LIVE DEMO BUTTON --- */}
                <button
                  className={styles.learnMore}
                  onClick={() => setShowDemoOptions(true)}
                >
                  <span className={styles.circle} aria-hidden="true">
                    <span className={`${styles.icon} ${styles.arrow}`}></span>
                  </span>
                  <span className={styles.buttonText}>Explore Live Demo</span>
                </button>
              </div>
            </div>
          </div>
        </section>
        <UniversityModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
        {/* [The rest of your JSX code remains exactly the same below here] */}
        {/* 2. SPLIT SECTION: BUZZ & LISTINGS */}
        <section className={styles.splitSection}>
          {/* Left Column: 35% */}
          <div className={styles.buzzColumn}>
            <div className={styles.sectionHeader}>
              <h2>
                Comunity Feed <span className={styles.liveDot}></span>
              </h2>
            </div>
            <div className={styles.buzzFeed}>
              {MOCK_BUZZ.map((post) => (
                <div key={post.id} className={styles.buzzCard}>
                  <div className={styles.buzzHeader}>
                    <img
                      src={post.avatar}
                      alt={post.name}
                      className={styles.buzzAvatar}
                    />
                    <div className={styles.buzzMeta}>
                      <h4>{post.name}</h4>
                      <span>
                        {post.time} • {post.location}
                      </span>
                    </div>
                  </div>
                  <p className={styles.buzzContent}>{post.content}</p>
                  <div className={styles.buzzActions}>
                    <span
                      className={styles.buzzAction}
                      onClick={() =>
                        setLikedPosts((prev) => ({
                          ...prev,
                          [post.id]: !prev[post.id],
                        }))
                      }
                    >
                      <Heart
                        size={16}
                        fill={likedPosts[post.id] ? "#EB487F" : "none"}
                        stroke={likedPosts[post.id] ? "#EB487F" : "#888"}
                      />
                      {post.likes + (likedPosts[post.id] ? 1 : 0)}
                    </span>
                    <span className={styles.buzzAction}>
                      <MessageCircle
                        size={16}
                        fill="#acaaaa"
                        stroke="#acaaaa"
                      />
                      {post.comments}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Right Column: 65% */}
          <div className={styles.listingsColumn}>
            <div className={styles.sectionHeader}>
              <h2>Recent Listings</h2>
            </div>
            <div className={styles.listingsGrid}>
              {MOCK_LISTINGS.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  currentUserId={currentUserId}
                  onCardClick={(id) => navigate(`/product/${id}`)}
                />
              ))}
            </div>
          </div>
        </section>
        {/* 4. HOW IT WORKS */}
        <section className={styles.infoSection}>
          <h2 className={styles.infoHeading}>How Yahora Works</h2>
          <div className={`${styles.infoGrid} ${styles.stepsGrid}`}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <ShieldCheck size={44} strokeWidth={1.5} />
              </div>
              <h3>Verify Identity</h3>
              <p>
                Log in securely using your official university email domain.
              </p>
              <div className={styles.featureDot}></div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <ShoppingBag size={44} strokeWidth={1.5} />
              </div>
              <h3>Post or Browse</h3>
              <p>
                List your old gear in seconds or scroll through what your peers
                are selling.
              </p>
              <div className={styles.featureDot}></div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Handshake size={44} strokeWidth={1.5} />
              </div>
              <h3>Connect & Meet</h3>
              <p>
                Chat in-app and meet up safely on campus to complete the
                exchange.
              </p>
              <div className={styles.featureDot}></div>
            </div>
          </div>
        </section>
        {/* 3. TRUST STRIP */}
        <section className={styles.trustStrip}>
          <div className={styles.trustItem}>
            <MailCheck className={styles.trustIcon} />
            <p>University email verification</p>
          </div>
          <div className={styles.trustItem}>
            <ShieldCheck className={styles.trustIcon} />
            <p>Campus-only community</p>
          </div>
          <div className={styles.trustItem}>
            <Handshake className={styles.trustIcon} />
            <p>Safe local pickup</p>
          </div>
          <div className={styles.trustItem}>
            <UserX className={styles.trustIcon} />
            <p>No random strangers</p>
          </div>
        </section>
        {/* 5. WHY STUDENTS LOVE YAHORA */}
        <section className={`${styles.infoSection} ${styles.benefitsSection}`}>
          <h2 className={styles.infoHeading}>Why Students Love Yahora...💕</h2>
          <div className={`${styles.infoGrid} ${styles.benefitsGrid}`}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <MapPin size={44} strokeWidth={1.5} />
              </div>
              <h3>Find Items Locally</h3>
              <p>Everything is located right near your hostel or department.</p>
              <div className={styles.featureDot}></div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Package size={44} strokeWidth={1.5} />
              </div>
              <h3>Hassle-Free Moves</h3>
              <p>
                Easily sell your old items right before the move-out week hits.
              </p>
              <div className={styles.featureDot}></div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <UserCheck size={44} strokeWidth={1.5} />
              </div>
              <h3>Real Students Only</h3>
              <p>
                Meet and transact with verified, real students from your
                college.
              </p>
              <div className={styles.featureDot}></div>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Shield size={44} strokeWidth={1.5} />
              </div>
              <h3>Scam-Free Zone</h3>
              <p>
                Our closed-loop ecosystem means absolutely no scammy listings.
              </p>
              <div className={styles.featureDot}></div>
            </div>
          </div>
        </section>
        {/* 6. CALL TO ACTION */}
        <section className={styles.ctaSection}>
          <h2>Keep the story going.</h2>
          <p>
            Join your campus marketplace today and discover what's waiting for
            you.
          </p>
          <div className={styles.ctaButtons}>
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className={styles.btnOutline}
                onClick={() =>
                  window.scrollTo({ top: 0, left: 0, behavior: "instant" })
                }
              >
                Marketplace
              </Link>
            ) : (
              <Link
                to="/auth"
                className={styles.btnOutline}
                onClick={() =>
                  window.scrollTo({ top: 0, left: 0, behavior: "instant" })
                }
              >
                Sign Up Now
              </Link>
            )}
          </div>
        </section>
      </div>

      {/* ── Demo Options Modal ── */}
      {showDemoOptions && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowDemoOptions(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.closeModalBtn}
              onClick={() => setShowDemoOptions(false)}
            >
              <X size={20} />
            </button>

            <h3 className={styles.modalTitle}>Choose Demo Experience</h3>

            <button
              type="button"
              className={styles.demoPopupBtn}
              onClick={handleDemoLogin}
              disabled={demoLoading}
            >
              <div className={styles.popupBtnTitle}>
                <Rocket size={18} />
                {demoLoading ? "Creating Sandbox..." : "Sandbox Preview"}
              </div>
              <span className={styles.popupBtnSubtext}>
                Limited Access • Live Environment
              </span>
            </button>

            <a
              href="https://www.youtube.com/watch?v=YOUR_YOUTUBE_LINK"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.demoPopupBtn} ${styles.videoBtn}`}
            >
              <div className={styles.popupBtnTitle}>
                <MonitorPlay size={18} /> Recorded Demo
              </div>
              <span className={styles.popupBtnSubtext}>
                Full Walkthrough • Actual Recording
              </span>
            </a>
          </div>
        </div>
      )}
    </>
  );
};
export default Home;
