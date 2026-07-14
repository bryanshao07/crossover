import { useRef, useState } from "react";
import Autocomplete from "../search/Autocomplete";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/client";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export default function AvatarPickerModal({ onClose }) {
  const { user, uploadAvatar, setAvatarFromPlayer, removeAvatar } = useAuth();

  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [savingPlayer, setSavingPlayer] = useState(false);

  const [removing, setRemoving] = useState(false);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    setFileError(null);
    setFile(null);
    setFilePreview(null);
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError("Unsupported file type. Use PNG, JPEG, or WebP.");
      return;
    }
    if (f.size > MAX_AVATAR_BYTES) {
      setFileError("File too large. Max 5MB.");
      return;
    }
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  }

  async function handleSaveFile() {
    if (!file) return;
    setUploading(true);
    setFileError(null);
    try {
      await uploadAvatar(file);
      onClose();
    } catch (err) {
      setFileError(err.response?.data?.detail || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSelectPlayer(name) {
    setSelectedPlayer(null);
    setPlayerError(null);
    setPlayerLoading(true);
    try {
      const detail = await api.getPlayer(name);
      if (!detail.player.headshot_url) {
        setPlayerError("No photo available for this player.");
      } else {
        setSelectedPlayer({ name, headshot_url: detail.player.headshot_url });
      }
    } catch {
      setPlayerError("Could not load that player.");
    } finally {
      setPlayerLoading(false);
    }
  }

  async function handleUsePlayerPhoto() {
    if (!selectedPlayer) return;
    setSavingPlayer(true);
    setPlayerError(null);
    try {
      await setAvatarFromPlayer(selectedPlayer.name);
      onClose();
    } catch (err) {
      setPlayerError(err.response?.data?.detail || "Could not set that photo.");
    } finally {
      setSavingPlayer(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeAvatar();
      onClose();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div className="relative w-full max-w-2xl glass p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider" style={{ color: "#e8ff47" }}>
            Change Profile Picture
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/90 transition-colors p-0.5"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="flex flex-col items-center gap-3 pr-6 border-r border-white/10">
            <h3 className="font-mono text-xs text-white/50 uppercase tracking-wider">Upload a Photo</h3>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-white/20 hover:border-accent transition-colors"
              style={{ backgroundColor: !filePreview ? "#4a7fff" : undefined }}
            >
              {filePreview && <img src={filePreview} alt="" className="w-full h-full object-cover" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            {fileError && <p className="text-xs text-red-400 text-center">{fileError}</p>}
            <button
              type="button"
              disabled={!file || uploading}
              onClick={handleSaveFile}
              className="mt-auto px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-bg bg-accent hover:brightness-110 transition-all disabled:opacity-40"
              style={{ borderRadius: "2px" }}
            >
              {uploading ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <h3 className="font-mono text-xs text-white/50 uppercase tracking-wider">Use a Player's Photo</h3>
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-white/20"
              style={{ backgroundColor: !selectedPlayer ? "#39d353" : undefined }}
            >
              {playerLoading ? (
                <span className="text-white/50 text-xs">Loading…</span>
              ) : (
                selectedPlayer && <img src={selectedPlayer.headshot_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="w-full">
              <Autocomplete onSelect={handleSelectPlayer} placeholder="Search a player…" />
            </div>
            {playerError && <p className="text-xs text-red-400 text-center">{playerError}</p>}
            <button
              type="button"
              disabled={!selectedPlayer || savingPlayer}
              onClick={handleUsePlayerPhoto}
              className="mt-auto px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-bg bg-accent hover:brightness-110 transition-all disabled:opacity-40"
              style={{ borderRadius: "2px" }}
            >
              {savingPlayer ? "Saving…" : "Use This Photo"}
            </button>
          </div>
        </div>

        {user?.avatar_url && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className="font-mono text-xs text-white/40 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              {removing ? "Removing…" : "Remove photo"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
