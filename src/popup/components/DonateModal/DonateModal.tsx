import React from 'react';
import './DonateModal.scss';

/**
 * Donate modal component
 * Shows donation options to support the extension
 */
interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  /** Handle donate button click */
  const handleDonate = (amount: string) => {
    let url = 'https://paypal.me/DevinDai';
    if (amount === '1') url = 'https://paypal.me/DevinDai/1';
    else if (amount === '2') url = 'https://paypal.me/DevinDai/2';
    else if (amount === '5') url = 'https://paypal.me/DevinDai/5';
    window.open(url, '_blank');
  };

  return (
    <div className="donate-overlay" onClick={onClose}>
      <div className="donate-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="donate-close" onClick={onClose}>
          ×
        </button>

        <div className="donate-icon">☕</div>
        <h2 className="donate-title">Support SimpleRequest</h2>
        <p className="donate-subtitle">
          Love this extension? Fuel future updates!
        </p>

        <div className="donate-buttons">
          <button
            className="donate-btn"
            onClick={() => handleDonate('1')}
          >
            $1
          </button>
          <button
            className="donate-btn"
            onClick={() => handleDonate('2')}
          >
            $2
          </button>
          <button
            className="donate-btn highlight"
            onClick={() => handleDonate('5')}
          >
            $5
          </button>
          <button
            className="donate-btn"
            onClick={() => handleDonate('any')}
          >
            Any
          </button>
        </div>

        <div className="donate-note">
          <p>Donating is optional!</p>
          <p>A Chrome Web Store review ⭐ also helps a lot.</p>
        </div>
      </div>
    </div>
  );
};

export default DonateModal;