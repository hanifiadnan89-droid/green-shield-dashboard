import { getIntakeMapId } from './intakeMapConfig.js';

export default function IntakeMapViewToolbar({
  mapType = 'satellite',
  onMapTypeChange,
  enable3d = false,
  onEnable3dChange,
  can3d = true,
  className = '',
  overlay = false,
}) {
  const mapIdConfigured = Boolean(getIntakeMapId());
  const threeDAvailable = can3d && mapIdConfigured;
  const threeDTitle = threeDAvailable
    ? 'Toggle 3D preview (remounts map with vector Map ID)'
    : mapIdConfigured
      ? '3D preview unavailable for this map'
      : 'VITE_GOOGLE_MAP_ID is not set in this client build — redeploy with the env var';

  return (
    <div
      className={[
        'intake-map-toolbar',
        'intake-map-toolbar--type',
        overlay ? 'intake-map-toolbar--overlay' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="intake-map-toolbar__left">
        <button
          type="button"
          className={`intake-map-btn ${mapType === 'satellite' ? 'intake-map-btn--active' : ''}`}
          onClick={() => onMapTypeChange?.('satellite')}
        >
          Satellite
        </button>
      </div>

      <div className="intake-map-toolbar__center">
        <button
          type="button"
          className={`intake-map-btn ${enable3d ? 'intake-map-btn--active' : ''}`}
          onClick={() => onEnable3dChange?.(!enable3d)}
          disabled={!threeDAvailable}
          title={threeDTitle}
        >
          3D Preview
        </button>
      </div>

      <div className="intake-map-toolbar__right">
        <button
          type="button"
          className={`intake-map-btn ${mapType === 'roadmap' ? 'intake-map-btn--active' : ''}`}
          onClick={() => onMapTypeChange?.('roadmap')}
        >
          Map
        </button>
      </div>
    </div>
  );
}
