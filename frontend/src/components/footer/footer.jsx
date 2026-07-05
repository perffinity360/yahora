// frontend\src\components\footer\footer.jsx
import React, { useState, useEffect } from "react";
import styles from "./footer.module.css";
import { supabase } from "../../config/supabaseClient";
// Filled inline SVG icons (lucide dropped brand glyphs and ships outline-only).
const svgProps = {
  viewBox: "0 0 24 24",
  width: 16,
  height: 16,
  fill: "currentColor",
};

const LocationIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
  </svg>
);
const PhoneIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
  </svg>
);
const WhatsappIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
);
const MailIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
  </svg>
);
const TwitterIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const InstagramIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);
const LinkedinIcon = (props) => (
  <svg {...svgProps} {...props}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const Footer = () => {
  const [visitorCount, setVisitorCount] = useState(0);

  useEffect(() => {
    const fetchAndIncrementCount = async () => {
      // Only increment if they haven't been counted in this specific browser tab session
      if (!sessionStorage.getItem("hasVisited")) {
        const { data, error } = await supabase.rpc("increment_page_view");
        if (!error && data !== null) {
          setVisitorCount(data);
          sessionStorage.setItem("hasVisited", "true");
        }
      } else {
        // If already visited this session, just fetch the current count without incrementing
        const { data, error } = await supabase
          .from("visitor_metrics")
          .select("view_count")
          .eq("id", 1)
          .single();
        if (!error && data) setVisitorCount(data.view_count);
      }
    };  

    fetchAndIncrementCount();
  }, []);

  return (
    <footer className={styles.footer}>
      <div className={styles.description}>
        <img src="/yahora_logo.svg" alt="Yahora Logo" className={styles.logo} />
        <p>
          Because Every Item Has a Memory. A high-trust, closed-loop community
          marketplace exclusively for students.
        </p>
      </div>

      <nav className={styles.navigation}>
        <h4>Quick Links</h4>
        <ul>
          <li>
            <a href="/">Home</a>
          </li>
          <li>
            <a href="/feed">Marketplace Feed</a>
          </li>
          <li>
            <a href="/hot">Trending on Campus</a>
          </li>
          <li>
            <a href="/messages">Messages</a>
          </li>
        </ul>
      </nav>

      <div className={styles.contactInfo}>
        <h4>Contact Us</h4>
        <ul>
          <li>
            <p className={styles.contactItem}>
              <LocationIcon className={styles.contactIcon} /> India
            </p>
          </li>
          <li>
            <a
              href="https://wa.me/919140400064"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.contactItem}
            >
              <WhatsappIcon className={styles.contactIcon} /> +91 9140400064
            </a>
          </li>
          <li>
            <p className={styles.contactItem}>
              <PhoneIcon className={styles.contactIcon} /> +91 6386444659
            </p>
          </li>
          <li>
            <p className={styles.contactItem}>
              <MailIcon className={styles.contactIcon} /> infiniper@gmail.com
            </p>
          </li>
        </ul>
      </div>

      <div className={styles.socialMedia}>
        <h4>Follow Us</h4>
        <ul>
          <li>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
            >
              <TwitterIcon className={styles.contactIcon} /> Twitter / X
            </a>
          </li>
          <li>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
            >
              <InstagramIcon className={styles.contactIcon} /> Instagram
            </a>
          </li>
          <li>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.socialLink}
            >
              <LinkedinIcon className={styles.contactIcon} /> LinkedIn
            </a>
          </li>
        </ul>
      </div>

      <div className={styles.newsletter}>
        <h4>Join Your Campus</h4>
        <p>Get updates on seasonal move-out sales and trending campus items!</p>
        <div className={styles.newsletterForm}>
          <input
            type="email"
            placeholder="Enter university email"
            className={styles.newsletterInput}
          />
          <button className={styles.newsletterButton}>Subscribe</button>
        </div>
      </div>

      <div className={styles.copyright}>
        <p>Copyright © 2026 Yahora. All Rights Reserved.</p>
        <div className={styles.legalLinks}>
          <a href="/terms">Terms & Conditions</a>
          <span>|</span>
          <a href="/privacy">Privacy Policy</a>
        </div>
        {/* NEW VISITOR COUNTER SECTION */}
        <div className={styles.visitorCounter}>
          <p>👀 Total Site Visits: {visitorCount}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
