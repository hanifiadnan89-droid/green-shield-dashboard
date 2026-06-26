import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, Link2, FileText, X, Loader2, CheckCircle2, AlertCircle,
  Youtube, Globe, FileAudio, FileVideo, Image, File,
} from 'lucide-react';
import { api } from '../../../../api/client.js';

const ACCEPT = [
  '.pdf,.doc,.docx,.txt,.md,.rtf,.csv,.xlsx,.xls,.pptx,.ppt',
  '.png,.jpg,.jpeg,.webp,.gif',
  '.mp3,.wav,.aac,.m4a,.flac',
  '.mp4,.mov,.avi,.mkv,.webm',
].join(',');

function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return FileVideo;
  if (['mp3','wav','aac','m4a','flac'].includes(ext)) return FileAudio;
  if (['png','jpg','jpeg','webp','gif'].includes(ext)) return Image;
  return File;
}

function FileRow({ name, size, onRemove }) {
  const Icon = getFileIcon(name);
  const mb   = size ? (size / (1024 * 1024)).toFixed(1) : null;
  return (
    <div className="kb-file-row">
      <Icon size={15} className="kb-file-row__icon" />
      <span className="kb-file-row__name">{name}</span>
      {mb && <span className="kb-file-row__size">{mb} MB</span>}
      <button type="button" className="kb-file-row__remove" onClick={onRemove}>
        <X size={13} />
      </button>
    </div>
  );
}

function UploadProgress({ item }) {
  const steps = item?.processingSteps || {};
  const labels = { extraction: 'Extracting', chunking: 'Chunking', embedding: 'Embedding', tagging: 'Tagging' };

  const status = item?.status;
  if (status === 'ready') {
    return (
      <div className="kb-progress kb-progress--done">
        <CheckCircle2 size={14} />
        Ready — {item.chunkCount} chunks, {item.wordCount?.toLocaleString()} words
        {item.autoTags?.length > 0 && <span className="kb-progress__tags">{item.autoTags.join(' · ')}</span>}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="kb-progress kb-progress--error">
        <AlertCircle size={14} />
        {item.errorMessage || 'Processing failed'}
      </div>
    );
  }

  return (
    <div className="kb-progress">
      <Loader2 size={13} className="kb-spinner" />
      <div className="kb-progress__steps">
        {Object.entries(labels).map(([key, label]) => (
          <span key={key} className={`kb-progress__step kb-progress__step--${steps[key] || 'pending'}`}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function KnowledgeUploader({ onItemCreated }) {
  const [tab,          setTab]          = useState('file');  // 'file' | 'url' | 'text'
  const [files,        setFiles]        = useState([]);
  const [url,          setUrl]          = useState('');
  const [text,         setText]         = useState('');
  const [title,        setTitle]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [queued,       setQueued]       = useState([]);  // { item, polling }
  const [dragging,     setDragging]     = useState(false);
  const [storageStatus, setStorageStatus] = useState(null);
  const inputRef = useRef();

  useEffect(() => {
    api.kb.storageStatus()
      .then(setStorageStatus)
      .catch((err) => setStorageStatus({ writeSafe: false, warning: err.message || 'Knowledge Base storage is unavailable.' }));
  }, []);

  // Poll a newly created item until it's done
  const pollItem = useCallback((item) => {
    let polls = 0;
    const interval = setInterval(async () => {
      polls++;
      if (polls > 120) { clearInterval(interval); return; } // 10 min timeout
      try {
        const { item: updated } = await api.kb.getItem(item.id);
        setQueued(q => q.map(q => q.item.id === item.id ? { ...q, item: updated } : q));
        if (updated.status === 'ready' || updated.status === 'error') {
          clearInterval(interval);
          if (updated.status === 'ready' && onItemCreated) onItemCreated(updated);
        }
      } catch {}
    }, 5000);
  }, [onItemCreated]);

  const addToQueue = useCallback((item) => {
    setQueued(q => [{ item }, ...q]);
    pollItem(item);
  }, [pollItem]);

  // ── File upload ──
  const handleFileUpload = async () => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        if (title) fd.append('title', title);
        const { item } = await api.kb.upload(fd);
        addToQueue(item);
      }
      setFiles([]);
      setTitle('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── URL ingest ──
  const handleUrlIngest = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { item } = await api.kb.ingestUrl(url.trim(), title);
      addToQueue(item);
      setUrl('');
      setTitle('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Text ingest ──
  const handleTextIngest = async () => {
    if (text.trim().length < 20) return;
    setLoading(true);
    setError(null);
    try {
      const { item } = await api.kb.ingestText(text.trim(), title || 'Manual Entry');
      addToQueue(item);
      setText('');
      setTitle('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Drag-and-drop ──
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (dropped.length) setFiles(f => [...f, ...dropped]);
  }, []);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const isYoutube = /youtube\.com|youtu\.be/.test(url);

  return (
    <div className="kb-uploader">
      {/* Tab switcher */}
      <div className="kb-upload-tabs">
        <button className={`kb-upload-tab${tab === 'file' ? ' kb-upload-tab--active' : ''}`} onClick={() => setTab('file')}>
          <Upload size={13} /> Files
        </button>
        <button className={`kb-upload-tab${tab === 'url' ? ' kb-upload-tab--active' : ''}`} onClick={() => setTab('url')}>
          <Link2 size={13} /> URL / YouTube
        </button>
        <button className={`kb-upload-tab${tab === 'text' ? ' kb-upload-tab--active' : ''}`} onClick={() => setTab('text')}>
          <FileText size={13} /> Paste Text
        </button>
      </div>

      {/* Title field (common) */}
      {storageStatus?.warning && (
        <div className="kb-storage-warning">
          <AlertCircle size={14} />
          <span>{storageStatus.warning}</span>
        </div>
      )}

      <input
        className="kb-title-input"
        type="text"
        placeholder="Title (optional — AI will suggest one)"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />

      {/* File tab */}
      {tab === 'file' && (
        <>
          <div
            className={`kb-dropzone${dragging ? ' kb-dropzone--over' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={28} className="kb-dropzone__icon" />
            <p className="kb-dropzone__label">Drag &amp; drop files here, or click to browse</p>
            <p className="kb-dropzone__hint">PDF · DOCX · XLSX · PPTX · TXT · PNG · JPG · MP3 · MP4 · MOV · and more</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              style={{ display: 'none' }}
              onChange={e => setFiles(f => [...f, ...Array.from(e.target.files)])}
            />
          </div>
          {files.length > 0 && (
            <div className="kb-file-list">
              {files.map((f, i) => (
                <FileRow
                  key={i}
                  name={f.name}
                  size={f.size}
                  onRemove={() => setFiles(files.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}
          <button
            className="kb-submit-btn"
            disabled={!files.length || loading}
            onClick={handleFileUpload}
          >
            {loading ? <><Loader2 size={15} className="kb-spinner" /> Uploading…</> : <><Upload size={15} /> Upload {files.length || ''} File{files.length !== 1 ? 's' : ''}</>}
          </button>
        </>
      )}

      {/* URL tab */}
      {tab === 'url' && (
        <>
          <div className="kb-url-input-wrap">
            {isYoutube ? <Youtube size={16} className="kb-url-icon kb-url-icon--yt" /> : <Globe size={16} className="kb-url-icon" />}
            <input
              className="kb-url-input"
              type="url"
              placeholder="https://youtube.com/watch?v=... or any web page"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrlIngest()}
            />
          </div>
          <p className="kb-url-hint">
            YouTube links get the video transcript. Web pages get scraped for article text.
          </p>
          <button
            className="kb-submit-btn"
            disabled={!url.trim() || loading}
            onClick={handleUrlIngest}
          >
            {loading ? <><Loader2 size={15} className="kb-spinner" /> Processing…</> : <><Link2 size={15} /> Add URL</>}
          </button>
        </>
      )}

      {/* Text tab */}
      {tab === 'text' && (
        <>
          <textarea
            className="kb-text-input"
            rows={8}
            placeholder="Paste a script, playbook, sales principle, pricing breakdown, rebuttal, competitor notes, or any sales knowledge…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <p className="kb-char-hint">{text.length.toLocaleString()} characters</p>
          <button
            className="kb-submit-btn"
            disabled={text.trim().length < 20 || loading}
            onClick={handleTextIngest}
          >
            {loading ? <><Loader2 size={15} className="kb-spinner" /> Processing…</> : <><FileText size={15} /> Add to Knowledge Base</>}
          </button>
        </>
      )}

      {error && (
        <div className="kb-error">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* Processing queue */}
      {queued.length > 0 && (
        <div className="kb-queue">
          <p className="kb-queue__label">Processing Queue</p>
          {queued.map(({ item }) => (
            <div key={item.id} className="kb-queue__item">
              <span className="kb-queue__title">{item.title || item.fileName || 'Item'}</span>
              <UploadProgress item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
