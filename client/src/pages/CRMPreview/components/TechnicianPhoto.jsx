import { useState } from 'react';
import { User } from 'lucide-react';
import { technicianInitials } from './RouteFinder/technicianPhotoUtils.js';

export default function TechnicianPhoto({
  techName,
  photoUrl,
  size = 'detail',
  className = '',
}) {
  const [failed, setFailed] = useState(false);
  const showImage = photoUrl && !failed;
  const initials = technicianInitials(techName);

  return (
    <div
      className={[
        'technician-photo',
        `technician-photo--${size}`,
        className,
      ].filter(Boolean).join(' ')}
      aria-hidden={!techName}
    >
      {showImage ? (
        <img
          src={photoUrl}
          alt=""
          className="technician-photo__img"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="technician-photo__fallback" aria-hidden>
          {initials !== '?' ? (
            <span className="technician-photo__initials">{initials}</span>
          ) : (
            <User className="technician-photo__icon" strokeWidth={1.75} />
          )}
        </div>
      )}
    </div>
  );
}
