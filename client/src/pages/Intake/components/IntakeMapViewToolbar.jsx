import { Maximize2, Minimize2 } from 'lucide-react';

export default function IntakeMapViewToolbar({
  mapType = 'satellite',
  onMapTypeChange,
  enable3d = false,
  onEnable3dChange,
  can3d = true,
  onExpand,
  isFullscreen = false,
  className = '',
  overlay = false,
}) {
  return (
    <div
      className={[
        'intake-map-toolbar',
        'intake-map-toolbar--type',
        overlay ? 'intake-map-toolbar--overlay' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className={`intake-map-btn ${mapType === 'satellite' ? 'intake-map-btn--active' : ''}`}
        onClick={() => onMapTypeChange?.('satellite')}
      >
        Satellite
      </button>
      <button
        type="button"
        className={`intake-map-btn ${mapType === 'roadmap' ? 'intake-map-btn--active' : ''}`}
        onClick={() => onMapTypeChange?.('roadmap')}
      >
        Map
      </button>
      <button
        type="button"
        className={`intake-map-btn ${enable3d ? 'intake-map-btn--active' : ''}`}
        onClick={() => onEnable3dChange?.(!enable3d)}
        disabled={!can3d}
        title={can3d ? 'Toggle 3D preview' : 'Set VITE_GOOGLE_MAP_ID to enable 3D preview'}
      >
        3D Preview
      </button>
      {onExpand && (
        <button
          type="button"
          className="intake-map-btn intake-map-btn--icon"
          onClick={onExpand}
          aria-label={isFullscreen ? 'Exit fullscreen map' : 'Expand map'}
          title={isFullscreen ? 'Exit fullscreen' : 'Expand map'}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      )}
    </div>
  );
}
