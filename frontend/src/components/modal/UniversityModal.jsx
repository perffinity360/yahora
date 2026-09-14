import React, { useState, useEffect } from "react";
import { Search, X, MapPin, Check } from "lucide-react";
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

  // A signed-in student's own campus is pinned above the search, so typing can
  // never filter it away. Logged out, or no university_id stored → no pin.
  const homeUniversityId = isAuthenticated
    ? localStorage.getItem("yahora_university_id")
    : null;
  const homeUniversity = homeUniversityId
    ? universities.find((uni) => uni.id === homeUniversityId)
    : null;

  const filteredUniversities = universities.filter(uni =>
    uni.id !== homeUniversity?.id && (
      uni.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      uni.domain.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>

        <div className={styles.modalHeader}>
          <h2>Supported Campuses</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {homeUniversity && (
          <div className={styles.pinnedSection}>
            <p className={styles.pinnedLabel}>Your campus</p>
            {/* This list is informational — there is no campus to switch to
                here, so selecting your own campus just closes the modal. */}
            <button
              type="button"
              className={`${styles.universityItem} ${styles.pinnedItem}`}
              onClick={onClose}
            >
              <MapPin size={20} className={styles.uniIcon} />
              <div className={styles.uniDetails}>
                <p className={styles.uniName}>{homeUniversity.name}</p>
                <p className={styles.uniDomain}>@{homeUniversity.domain}</p>
              </div>
              <Check size={18} strokeWidth={2.5} className={styles.pinnedCheck} />
            </button>
          </div>
        )}

        <div className={styles.searchContainer}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search your university or domain..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.universityList}>
          {loading ? (
            <p className={styles.loadingText}>Loading campuses...</p>
          ) : filteredUniversities.length > 0 ? (
            filteredUniversities.map((uni) => (
              <div key={uni.id} className={styles.universityItem}>
                <MapPin size={20} className={styles.uniIcon} />
                <div className={styles.uniDetails}>
                  <p className={styles.uniName}>{uni.name}</p>
                  <p className={styles.uniDomain}>@{uni.domain}</p>
                </div>
              </div>
            ))
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
