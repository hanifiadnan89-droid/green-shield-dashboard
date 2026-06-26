# Training Center Knowledge Base Persistence

The Training Center Knowledge Base is production business data. On Render, do not
store it in the repo/deploy directory because that filesystem is ephemeral across
redeploys.

## Render Persistent Disk Setup

Configure a Render persistent disk for the web service:

- Mount path: `/var/data`
- Environment variable: `KNOWLEDGE_STORAGE_BACKEND=persistent_disk`
- Environment variable: `KNOWLEDGE_DATA_DIR=/var/data/knowledge-base`

The Knowledge Base stores these files under `KNOWLEDGE_DATA_DIR`:

- `knowledge-base-items.json`
- `knowledge-base-chunks.json`
- `knowledge-base-embeddings.json`
- `knowledge-uploads/`

On startup, the server logs the active Knowledge Base storage backend, data
directory, and upload directory.

## Production Safety Guard

When running on Render in production, writes are refused unless storage is
explicitly configured outside the repo/deploy directory with a durable backend.
This prevents uploads from appearing to succeed while being lost on redeploy.

## Large Audio And Video

Training Center audio and video uploads are preserved as original uploads, then
transcribed during extraction. Files larger than `MEDIA_TRANSCRIPTION_MAX_BYTES`
are automatically compressed and split into ordered temporary audio chunks before
transcription. The default limit is:

```txt
MEDIA_TRANSCRIPTION_MAX_BYTES=24000000
```

The chunk transcripts are merged back into one Knowledge Base item with
timestamps such as `[00:15:00]`, so long training recordings do not need manual
trimming before upload. Temporary chunk files are removed after extraction.

Large media splitting requires ffmpeg. The production dependency
`ffmpeg-static` supplies the binary used by the server. If ffmpeg is unavailable,
oversized uploads keep their original file and metadata, and extraction records:

```txt
Audio file is too large and ffmpeg is not available to split it.
```

## Migration

If existing Knowledge Base files are present in `server/data`, startup migration
copies them to `KNOWLEDGE_DATA_DIR` when that directory is configured.

Migration behavior:

- Old files are not deleted.
- A backup is created under `KNOWLEDGE_DATA_DIR/legacy-backup-<timestamp>/`.
- Existing target files are not overwritten.

After migration, verify the Training Center list and Sales Coach retrieval before
removing any legacy local files manually.
