import { useEffect, useRef, useState, useCallback } from 'react';

function getPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = event.touches?.[0]?.clientX ?? event.clientX;
  const clientY = event.touches?.[0]?.clientY ?? event.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

export default function SignaturePad({
  label,
  hint,
  height = 160,
  onChange,
  onDone,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const redrawBlank = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsEmpty(true);
    onChange?.(null);
  }, [onChange]);

  useEffect(() => {
    redrawBlank();
  }, [redrawBlank]);

  function startDraw(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(canvas, event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function moveDraw(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const point = getPoint(canvas, event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setIsEmpty(false);
  }

  function endDraw(event) {
    if (!drawingRef.current) return;
    event?.preventDefault?.();
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange?.(canvas.toDataURL('image/png'));
  }

  function handleClear() {
    redrawBlank();
  }

  function handleDone() {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;
    onDone?.(canvas.toDataURL('image/png'));
  }

  return (
    <div className="signature-pad">
      <div className="signature-pad__header">
        <div>
          <p className="signature-pad__title">{label}</p>
          {hint ? <p className="signature-pad__hint">{hint}</p> : null}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        className="signature-pad__canvas"
        width={720}
        height={height}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
      />
      <div className="signature-pad__actions">
        <button type="button" className="signature-pad__secondary" onClick={handleClear}>
          Clear
        </button>
        <button
          type="button"
          className="signature-pad__primary"
          onClick={handleDone}
          disabled={isEmpty}
        >
          Done
        </button>
      </div>
    </div>
  );
}
