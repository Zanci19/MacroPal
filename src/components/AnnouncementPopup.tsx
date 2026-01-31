import React from "react";
import {
  IonModal,
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
} from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import "./AnnouncementPopup.css";

export interface AnnouncementData {
  title: string;
  image: string;
  imageAlt: string;
  message: string;
  buttonText: string;
  announcementNum: number;
}

interface AnnouncementPopupProps {
  isOpen: boolean;
  announcement: AnnouncementData | null;
  onDismiss: () => void;
}

const AnnouncementPopup: React.FC<AnnouncementPopupProps> = ({
  isOpen,
  announcement,
  onDismiss,
}) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [isOpen]);

  if (!announcement) return null;

  const imageUrl = announcement.image.startsWith("http")
    ? announcement.image
    : "https://zanci19.github.io/macro.pal/app/home-popups/images/home-popups-image.png"

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      className="announcement-popup"
    >
      <IonContent className="announcement-popup-content">
        <div className="announcement-popup-container">
          <button
            className="announcement-popup-close"
            onClick={() => {
              console.log(`[USER ACTION] Announcement Popup: Closed announcement using X button`, {
                announcementNum: announcement.announcementNum,
                title: announcement.title,
              });
              onDismiss();
            }}
            aria-label="Close announcement"
          >
            <IonIcon icon={closeOutline} />
          </button>

          <div className="announcement-popup-image-container">
            {!imageLoaded && !imageError && (
              <div className="announcement-popup-image-loading">
                <IonSpinner name="crescent" />
              </div>
            )}
            {imageError && (
              <div className="announcement-popup-image-error">
                <p>Image could not be loaded</p>
              </div>
            )}
            <img
              src={imageUrl}
              alt={announcement.imageAlt}
              className={`announcement-popup-image ${imageLoaded ? "loaded" : ""}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
              style={{ display: imageError ? "none" : "block" }}
            />
          </div>

          <div className="announcement-popup-body">
            <h2 className="announcement-popup-title">{announcement.title}</h2>
            <p className="announcement-popup-message">{announcement.message}</p>
            <IonButton
              expand="block"
              className="announcement-popup-button"
              onClick={() => {
                console.log(`[USER ACTION] Announcement Popup: Clicked announcement button`, {
                  announcementNum: announcement.announcementNum,
                  title: announcement.title,
                  buttonText: announcement.buttonText,
                });
                onDismiss();
              }}
            >
              {announcement.buttonText}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default AnnouncementPopup;
