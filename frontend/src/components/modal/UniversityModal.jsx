import React, { useState, useEffect } from "react";
import { Search, X, MapPin } from "lucide-react";
import styles from "./UniversityModal.module.css";

const UniversityModal = ({ isOpen, onClose }) => {
  const [universities, setUniversities] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

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
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/universities`);
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

  const filteredUniversities = universities.filter(uni => 
    uni.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    uni.domain.toLowerCase().includes(searchTerm.toLowerCase())
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