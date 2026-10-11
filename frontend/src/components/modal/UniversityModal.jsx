import React, { useState, useEffect } from "react";
import { Search, X, Check, House } from "lucide-react";
import styles from "./UniversityModal.module.css";
import { API_BASE_URL } from '../../config/urls';
import { useAuth } from "../../contexts/AuthContext";

const UniversityModal = ({ isOpen, onClose }) => {
  const [universities, setUniversities] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchUniversities();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const fetchUniversities = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/universities`);
      if (response.ok) {
        const data = await response.json();
        setUniversities(data);
      }
    } catch (error) {
      console.error("Failed to load universities");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // A signed-in student's own campus stays in its normal place in the list
  // (not pinned) but keeps the highlighted look. Logged out → no highlight.
  const homeUniversityId = isAuthenticated
    ? localStorage.getItem("yahora_university_id")
    : null;
  const homeUniversity = homeUniversityId
    ? universities.find((uni) => uni.id === homeUniversityId)
    : null;

  const filteredUniversities = universities.filter(uni =>
    uni.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    uni.domain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>

        {/* Styled to match the Marketplace "Switch Campus" picker. */}
        <div className={styles.modalHeader}>
          <h2>Supported Campuses</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className={styles.searchWrap}>
          <div className={styles.searchContainer}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search universities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.universityList}>
          {loading ? (
            <p className={styles.loadingText}>Loading campuses...</p>
          ) : filteredUniversities.length > 0 ? (
            filteredUniversities.map((uni) =>
              uni.id === homeUniversity?.id ? (
                /* This list is informational — there is no campus to switch
                   to here, so selecting your own campus just closes the modal. */
                <button
                  key={uni.id}
                  type="button"
                  className={`${styles.universityItem} ${styles.pinnedItem}`}
                  onClick={onClose}
                >
                  <span className={`${styles.uniDot} ${styles.uniDotActive}`} />
                  <div className={styles.uniDetails}>
                    <p className={styles.uniName}>{uni.name}</p>
                    <p className={styles.uniDomain}>{uni.domain}</p>
                    <span className={styles.homeBadge}>
                      <House size={11} strokeWidth={2.5} aria-hidden="true" />
                      Home campus
                    </span>
                  </div>
                  <span className={styles.pinnedCheck}>
                    <Check size={13} strokeWidth={3} />
                  </span>
                </button>
              ) : (
                <div key={uni.id} className={styles.universityItem}>
                  <span className={styles.uniDot} />
                  <div className={styles.uniDetails}>
                    <p className={styles.uniName}>{uni.name}</p>
                    <p className={styles.uniDomain}>{uni.domain}</p>
                  </div>
                </div>
              ),
            )
          ) : (
            <p className={styles.noResults}>
              No campuses found matching "{searchTerm}"
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default UniversityModal;
