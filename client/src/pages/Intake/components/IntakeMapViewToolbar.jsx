import { Maximize2, Minimize2 } from 'lucide-react';
import { INTAKE_3D_PREVIEW_ENABLED } from './intakeMapConfig.js';

export default function IntakeMapViewToolbar({
  mapType = 'satellite',
  onMapTypeChange,
  enable3d = false,
  onEnable3dChange,
  can3d = true,
  onExpand,
  isExpanded = false,
  className = '',
  overlay = false,
}) {
  const show3d = INTAKE_3D_PREVIEW_ENABLED && can3d;
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
      {show3d && (
        <button
          type="button"
          className={`intake-map-btn ${enable3d ? 'intake-map-btn--active' : ''}`}
          onClick={() => onEnable3dChange?.(!enable3d)}
          title="Toggle 3D preview"
        >
          3D Preview
        </button>
      )}
      {onExpand && (
        <button
          type="button"
          className="intake-map-btn intake-map-btn--icon"
          onClick={onExpand}
          aria-label={isExpanded ? 'Close expanded map' : 'Expand map'}
          title={isExpanded ? 'Close expanded map' : 'Expand map'}
        >
          {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      )}
    </div>
  );
}
