import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Fonts ────────────────────────────────────────────────────────────────────
const fontLink = document.createElement('link');
fontLink.rel = 'stylesheet';
fontLink.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap';
if (!document.head.querySelector('[href*="Syne"]')) document.head.appendChild(fontLink);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  // Background layers
  bg0: '#08090C',
  bg1: '#0E1016',
  bg2: '#13151E',
  bg3: '#1A1D28',
  bg4: '#1F2235',

  // Borders
  border:      'rgba(255,255,255,0.06)',
  borderHover: 'rgba(255,255,255,0.12)',
  borderFocus: '#4F6EF7',

  // Text
  text100: '#F2F3F7',
  text60:  '#8B90A7',
  text40:  '#555A72',
  text20:  '#2E3145',

  // Brand / accent
  accent:      '#4F6EF7',
  accentHover: '#3D5CE8',
  accentMuted: 'rgba(79,110,247,0.12)',
  accentRing:  'rgba(79,110,247,0.30)',

  // Semantic
  success:      '#2CB67D',
  successMuted: 'rgba(44,182,125,0.10)',
  successBorder:'rgba(44,182,125,0.20)',

  warning:      '#D4A017',
  warningMuted: 'rgba(212,160,23,0.10)',
  warningBorder:'rgba(212,160,23,0.20)',

  danger:      '#E05A5A',
  dangerMuted: 'rgba(224,90,90,0.10)',
  dangerBorder:'rgba(224,90,90,0.20)',

  // Radius
  r4:  '4px',
  r8:  '8px',
  r12: '12px',
  r16: '16px',
};

// ─── Base styles (injected once) ──────────────────────────────────────────────
const styleId = 'blurt-sched-styles';
if (!document.getElementById(styleId)) {
  const s = document.createElement('style');
  s.id = styleId;
  s.textContent = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg0}; }

    .bs-input {
      width: 100%;
      padding: 10px 14px;
      border-radius: ${T.r8};
      border: 1px solid ${T.border};
      background: ${T.bg2};
      color: ${T.text100};
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .bs-input::placeholder { color: ${T.text40}; }
    .bs-input:hover  { border-color: ${T.borderHover}; }
    .bs-input:focus  { border-color: ${T.borderFocus}; box-shadow: 0 0 0 3px ${T.accentRing}; }

    .bs-textarea {
      width: 100%;
      padding: 12px 14px;
      border-radius: ${T.r8};
      border: 1px solid ${T.border};
      background: ${T.bg2};
      color: ${T.text100};
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      outline: none;
      resize: vertical;
      line-height: 1.6;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .bs-textarea::placeholder { color: ${T.text40}; }
    .bs-textarea:hover  { border-color: ${T.borderHover}; }
    .bs-textarea:focus  { border-color: ${T.borderFocus}; box-shadow: 0 0 0 3px ${T.accentRing}; }

    .bs-btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 20px;
      border-radius: ${T.r8};
      border: none;
      background: ${T.accent};
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: background 0.15s, opacity 0.15s, transform 0.1s;
      white-space: nowrap;
      letter-spacing: 0.01em;
    }
    .bs-btn-primary:hover:not(:disabled)  { background: ${T.accentHover}; }
    .bs-btn-primary:active:not(:disabled) { transform: scale(0.98); }
    .bs-btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .bs-btn-ghost {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 9px 16px;
      border-radius: ${T.r8};
      border: 1px solid ${T.border};
      background: transparent;
      color: ${T.text60};
      font-size: 13px;
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .bs-btn-ghost:hover { background: ${T.bg3}; border-color: ${T.borderHover}; color: ${T.text100}; }

    .bs-btn-danger-sm {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px;
      border-radius: ${T.r8};
      border: 1px solid ${T.dangerBorder};
      background: ${T.dangerMuted};
      color: ${T.danger};
      font-size: 12px;
      font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .bs-btn-danger-sm:hover { background: rgba(224,90,90,0.18); border-color: rgba(224,90,90,0.35); }

    .bs-btn-upload {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 14px;
      border-radius: ${T.r8};
      border: 1px solid ${T.border};
      background: ${T.bg3};
      color: ${T.text60};
      font-size: 13px;
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .bs-btn-upload:hover { background: ${T.bg4}; color: ${T.text100}; border-color: ${T.borderHover}; }

    .bs-tab {
      padding: 8px 16px;
      border-radius: ${T.r8};
      border: none;
      background: transparent;
      color: ${T.text40};
      font-size: 13px;
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      letter-spacing: 0.01em;
    }
    .bs-tab:hover { color: ${T.text60}; background: ${T.bg3}; }
    .bs-tab.active {
      background: ${T.accentMuted};
      color: ${T.accent};
      font-weight: 600;
    }

    .bs-card {
      background: ${T.bg1};
      border: 1px solid ${T.border};
      border-radius: ${T.r12};
    }

    .bs-divider {
      height: 1px;
      background: ${T.border};
      width: 100%;
    }

    .bs-tag {
      display: inline-flex; align-items: center;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-family: 'DM Sans', sans-serif;
    }
    .bs-tag-pending { background: ${T.warningMuted}; color: ${T.warning}; border: 1px solid ${T.warningBorder}; }
    .bs-tag-done    { background: ${T.successMuted}; color: ${T.success}; border: 1px solid ${T.successBorder}; }
    .bs-tag-failed  { background: ${T.dangerMuted};  color: ${T.danger};  border: 1px solid ${T.dangerBorder};  }

    .bs-alert-error {
      padding: 10px 14px;
      border-radius: ${T.r8};
      border: 1px solid ${T.dangerBorder};
      background: ${T.dangerMuted};
      color: ${T.danger};
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
    }
    .bs-alert-success {
      padding: 10px 14px;
      border-radius: ${T.r8};
      border: 1px solid ${T.successBorder};
      background: ${T.successMuted};
      color: ${T.success};
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
    }
    .bs-alert-neutral {
      padding: 10px 14px;
      border-radius: ${T.r8};
      border: 1px solid ${T.border};
      background: ${T.bg3};
      color: ${T.text60};
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
    }

    .bs-post-row {
      transition: background 0.15s;
    }
    .bs-post-row:hover { background: ${T.bg2}; }

    .bs-spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.15);
      border-top-color: #fff;
      border-radius: 50%;
      animation: bs-spin 0.65s linear infinite;
      flex-shrink: 0;
    }
    @keyframes bs-spin { to { transform: rotate(360deg); } }

    .bs-count-chip {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 20px; height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: ${T.bg3};
      border: 1px solid ${T.border};
      color: ${T.text40};
      font-size: 11px;
      font-weight: 600;
    }

    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${T.bg4}; border-radius: 3px; }
  `;
  document.head.appendChild(s);
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusTag({ status }) {
  const map = {
    pending: { cls: 'bs-tag bs-tag-pending', label: 'Pending' },
    done:    { cls: 'bs-tag bs-tag-done',    label: 'Published' },
    failed:  { cls: 'bs-tag bs-tag-failed',  label: 'Failed' },
  };
  const m = map[status] || map.pending;
  return <span className={m.cls}>{m.label}</span>;
}

function Label({ children, required }) {
  return (
    <label style={{
      display: 'block',
      fontSize: '12px',
      fontWeight: '500',
      color: T.text60,
      marginBottom: '6px',
      letterSpacing: '0.02em',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {children}
      {required && <span style={{ color: T.danger, marginLeft: '3px' }}>*</span>}
    </label>
  );
}

function Field({ children }) {
  return <div style={{ marginBottom: '20px' }}>{children}</div>;
}

function Divider() {
  return <div className="bs-divider" />;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const [loggedIn, setLoggedIn]       = useState(false);
  const [username, setUsername]       = useState('');
  const [loginForm, setLoginForm]     = useState({ username: '', postingKey: '' });
  const [loginError, setLoginError]   = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [posts, setPosts]             = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeTab, setActiveTab]     = useState('schedule');
  const [form, setForm]               = useState({ title: '', body: '', tags: 'blurt', scheduled_time: '' });
  const [formError, setFormError]     = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronResult, setCronResult]   = useState('');
  const [now, setNow]                 = useState(new Date());
  const textareaRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('blurt_user');
    if (saved) { setUsername(saved); setLoggedIn(true); }
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!username) return;
    setPostsLoading(true);
    try {
      const res  = await fetch(`/api/posts?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.success) setPosts(data.posts || []);
    } catch (e) { console.error(e); }
    finally { setPostsLoading(false); }
  }, [username]);

  useEffect(() => {
    if (loggedIn && username) fetchPosts();
  }, [loggedIn, username, fetchPosts]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res  = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:   loginForm.username.trim(),
          postingKey: loginForm.postingKey.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem('blurt_user', data.username);
        setUsername(data.username);
        setLoggedIn(true);
        setLoginForm({ username: '', postingKey: '' });
      } else {
        setLoginError(data.error || 'Authentication failed.');
      }
    } catch {
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem('blurt_user');
    setLoggedIn(false);
    setUsername('');
    setPosts([]);
    setForm({ title: '', body: '', tags: 'blurt', scheduled_time: '' });
  }

  async function handleSchedule(e) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);
    if (!form.title || !form.body || !form.scheduled_time) {
      setFormError('Title, body, and scheduled time are required.');
      setFormLoading(false);
      return;
    }
    try {
      const res  = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          ...form,
          scheduled_time: new Date(form.scheduled_time).toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFormSuccess(`Post scheduled for ${formatDate(form.scheduled_time)}.`);
        setForm({ title: '', body: '', tags: 'blurt', scheduled_time: '' });
        fetchPosts();
        setTimeout(() => setActiveTab('list'), 1500);
      } else {
        setFormError(data.error || 'Failed to schedule post.');
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(postId) {
    if (!confirm('Cancel this scheduled post?')) return;
    try {
      const res  = await fetch(`/api/posts/${postId}?username=${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.success) fetchPosts();
      else alert(data.error || 'Delete failed.');
    } catch { alert('Network error.'); }
  }

  async function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setFormError('');
    setFormSuccess('Uploading image...');
    try {
      const res  = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, imageBase64: base64, filename: file.name || 'image.png' }),
      });
      const data = await res.json();
      if (data.success) {
        const markdown = '\n\n' + data.markdown + '\n\n';
        const textarea = textareaRef.current;
        if (textarea) {
          const start    = textarea.selectionStart;
          const end      = textarea.selectionEnd;
          const newBody  = form.body.substring(0, start) + markdown + form.body.substring(end);
          setForm(prev => ({ ...prev, body: newBody }));
          setTimeout(() => {
            textarea.focus();
            const newPos = start + markdown.length;
            textarea.setSelectionRange(newPos, newPos);
          }, 50);
        } else {
          setForm(prev => ({ ...prev, body: prev.body + markdown }));
        }
        setFormSuccess('Image uploaded.');
        setTimeout(() => setFormSuccess(''), 3000);
      } else {
        setFormError('Upload failed: ' + data.error);
      }
    } catch (err) {
      setFormError('Upload error: ' + err.message);
    }
  }

  async function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        await handleImageUpload(file);
        break;
      }
    }
  }

  async function handleTriggerCron() {
    setCronLoading(true);
    setCronResult('');
    try {
      const res  = await fetch('/api/check-posts');
      const data = await res.json();
      if (data.message === 'No posts due') {
        setCronResult('No posts are due at this time.');
      } else if (data.published > 0) {
        setCronResult(`${data.published} post${data.published > 1 ? 's' : ''} published.`);
        fetchPosts();
      } else if (data.failed > 0) {
        setCronResult(`${data.failed} post${data.failed > 1 ? 's' : ''} failed. Review the post list for details.`);
        fetchPosts();
      } else {
        setCronResult(JSON.stringify(data));
      }
    } catch (err) {
      setCronResult('Error: ' + err.message);
    } finally {
      setCronLoading(false);
    }
  }

  function getMinDateTime() {
    const d      = new Date(Date.now() + 2 * 60 * 1000);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d - offset).toISOString().slice(0, 16);
  }

  function getCountdown(scheduledTime) {
    const diff = new Date(scheduledTime) - now;
    if (diff <= 0) return 'Due now';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins >= 60) {
      const hrs        = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m remaining`;
    }
    return `${mins}m ${secs}s remaining`;
  }

  const pendingCount = posts.filter(p => p.status === 'pending').length;
  const doneCount    = posts.filter(p => p.status === 'done').length;
  const failedCount  = posts.filter(p => p.status === 'failed').length;

  // ─── LOGIN ─────────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div style={{
        minHeight: '100vh',
        background: T.bg0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* Subtle grid texture */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />

        <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>

          {/* Logo mark */}
          <div style={{ marginBottom: '40px', textAlign: 'center' }}>
            <div style={{
              width: '48px', height: '48px',
              background: T.accentMuted,
              border: `1px solid rgba(79,110,247,0.25)`,
              borderRadius: T.r12,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '20px',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={T.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '700', color: T.text100, letterSpacing: '-0.02em', fontFamily: "'Syne', sans-serif", margin: 0 }}>
                Blurt Scheduler
              </h1>
              <p style={{ color: T.text40, fontSize: '13px', marginTop: '4px' }}>
                Authenticated post scheduling
              </p>
            </div>
          </div>

          <div className="bs-card" style={{ padding: '28px' }}>
            <form onSubmit={handleLogin}>
              <Field>
                <Label required>Username</Label>
                <input
                  className="bs-input"
                  type="text"
                  placeholder="account (without @)"
                  value={loginForm.username}
                  onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field>
                <Label required>Posting Key (WIF)</Label>
                <input
                  className="bs-input"
                  type="password"
                  placeholder="5K..."
                  value={loginForm.postingKey}
                  onChange={e => setLoginForm({ ...loginForm, postingKey: e.target.value })}
                  autoComplete="off"
                  required
                />
                <p style={{ marginTop: '8px', fontSize: '12px', color: T.text40, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="11" height="12" viewBox="0 0 12 14" fill="none"><rect x="1" y="6" width="10" height="8" rx="1.5" stroke={T.text40} strokeWidth="1.2"/><path d="M4 6V4a2 2 0 0 1 4 0v2" stroke={T.text40} strokeWidth="1.2"/></svg>
                  AES-256 encrypted before storage
                </p>
              </Field>

              {loginError && (
                <div className="bs-alert-error" style={{ marginBottom: '16px' }}>{loginError}</div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="bs-btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px 20px' }}
              >
                {loginLoading ? <><span className="bs-spinner" />Verifying...</> : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg0,
      fontFamily: "'DM Sans', sans-serif",
      color: T.text100,
    }}>

      {/* Top nav */}
      <div style={{
        height: '56px',
        borderBottom: `1px solid ${T.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        background: T.bg0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px',
            background: T.accentMuted,
            border: `1px solid rgba(79,110,247,0.2)`,
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={{ fontSize: '14px', fontWeight: '600', color: T.text100, fontFamily: "'Syne', sans-serif", letterSpacing: '-0.01em' }}>
            Blurt Scheduler
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '7px', height: '7px',
              borderRadius: '50%',
              background: T.success,
              boxShadow: `0 0 6px ${T.success}`,
            }} />
            <span style={{ fontSize: '13px', color: T.text60 }}>@{username}</span>
          </div>
          <button className="bs-btn-ghost" onClick={handleLogout} style={{ padding: '6px 12px', fontSize: '12px' }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Page header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: T.text100, letterSpacing: '-0.03em', fontFamily: "'Syne', sans-serif", marginBottom: '4px' }}>
            Post Queue
          </h1>
          <p style={{ fontSize: '14px', color: T.text40 }}>
            Manage scheduled publications for @{username}
          </p>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Pending',   value: pendingCount, color: T.warning,  border: T.warningBorder, bg: T.warningMuted },
            { label: 'Published', value: doneCount,    color: T.success,  border: T.successBorder, bg: T.successMuted },
            { label: 'Failed',    value: failedCount,  color: T.danger,   border: T.dangerBorder,  bg: T.dangerMuted  },
          ].map(s => (
            <div
              key={s.label}
              className="bs-card"
              style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: T.r8,
                background: s.bg, border: `1px solid ${s.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: s.color }}>{s.value}</span>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: T.text100, letterSpacing: '-0.02em', fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '11px', color: T.text40, marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' }}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Publish trigger */}
        <div className="bs-card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: T.text100 }}>Publish Due Posts</div>
              <div style={{ fontSize: '12px', color: T.text40, marginTop: '2px' }}>
                Trigger publishing for all posts whose scheduled time has passed.
              </div>
            </div>
            <button
              className="bs-btn-primary"
              onClick={handleTriggerCron}
              disabled={cronLoading}
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              {cronLoading ? <><span className="bs-spinner" />Running...</> : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="white"/></svg>
                  Run Now
                </>
              )}
            </button>
          </div>
          {cronResult && (
            <div className="bs-alert-neutral" style={{ marginTop: '12px' }}>{cronResult}</div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: T.bg1, border: `1px solid ${T.border}`, borderRadius: T.r8, padding: '4px', width: 'fit-content' }}>
          <button
            className={`bs-tab${activeTab === 'schedule' ? ' active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            New Post
          </button>
          <button
            className={`bs-tab${activeTab === 'list' ? ' active' : ''}`}
            onClick={() => { setActiveTab('list'); fetchPosts(); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            All Posts
            <span className="bs-count-chip">{posts.length}</span>
          </button>
        </div>

        {/* Schedule form */}
        {activeTab === 'schedule' && (
          <div className="bs-card" style={{ padding: '28px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: T.text100, fontFamily: "'Syne', sans-serif", letterSpacing: '-0.01em', margin: 0 }}>
                Schedule a Post
              </h2>
              <p style={{ fontSize: '13px', color: T.text40, marginTop: '4px' }}>
                The post will be published to Blurt at the specified time.
              </p>
            </div>
            <Divider />
            <div style={{ marginTop: '24px' }}>
              <form onSubmit={handleSchedule}>
                <Field>
                  <Label required>Title</Label>
                  <input
                    className="bs-input"
                    type="text"
                    placeholder="Post title"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </Field>

                <Field>
                  <Label required>Content</Label>
                  <textarea
                    ref={textareaRef}
                    className="bs-textarea"
                    style={{ height: '180px' }}
                    placeholder="Write post content in Markdown. Paste images with Ctrl+V."
                    value={form.body}
                    onChange={e => setForm({ ...form, body: e.target.value })}
                    onPaste={handlePaste}
                    required
                  />
                  <div style={{ marginTop: '8px' }}>
                    <label className="bs-btn-upload" style={{ display: 'inline-flex' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Upload Image
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => e.target.files[0] && handleImageUpload(e.target.files[0])}
                      />
                    </label>
                  </div>
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <Field>
                    <Label>Tags</Label>
                    <input
                      className="bs-input"
                      type="text"
                      placeholder="blurt, photography"
                      value={form.tags}
                      onChange={e => setForm({ ...form, tags: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <Label required>Scheduled Time</Label>
                    <input
                      className="bs-input"
                      type="datetime-local"
                      min={getMinDateTime()}
                      value={form.scheduled_time}
                      onChange={e => setForm({ ...form, scheduled_time: e.target.value })}
                      required
                    />
                  </Field>
                </div>

                {formError   && <div className="bs-alert-error"   style={{ marginBottom: '16px' }}>{formError}</div>}
                {formSuccess && <div className="bs-alert-success" style={{ marginBottom: '16px' }}>{formSuccess}</div>}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="bs-btn-primary"
                  >
                    {formLoading ? <><span className="bs-spinner" />Scheduling...</> : 'Schedule Post'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Posts list */}
        {activeTab === 'list' && (
          <div>
            {postsLoading ? (
              <div className="bs-card" style={{ padding: '48px', textAlign: 'center', color: T.text40 }}>
                <div className="bs-spinner" style={{ margin: '0 auto 12px', width: '20px', height: '20px', borderWidth: '2px', borderTopColor: T.accent }} />
                <div style={{ fontSize: '13px' }}>Loading posts...</div>
              </div>
            ) : posts.length === 0 ? (
              <div className="bs-card" style={{ padding: '60px 40px', textAlign: 'center' }}>
                <div style={{
                  width: '48px', height: '48px',
                  background: T.bg3,
                  border: `1px solid ${T.border}`,
                  borderRadius: T.r12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="16" rx="2" stroke={T.text40} strokeWidth="1.5"/>
                    <path d="M3 8h18M8 4v4M16 4v4" stroke={T.text40} strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M7 13h10M7 17h6" stroke={T.text40} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: T.text60, marginBottom: '6px', fontFamily: "'Syne', sans-serif" }}>
                  No posts scheduled
                </h3>
                <p style={{ fontSize: '13px', color: T.text40, marginBottom: '20px' }}>
                  Create a scheduled post to get started.
                </p>
                <button
                  className="bs-btn-primary"
                  onClick={() => setActiveTab('schedule')}
                  style={{ fontSize: '13px' }}
                >
                  Create Post
                </button>
              </div>
            ) : (
              <div className="bs-card" style={{ overflow: 'hidden' }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 160px 80px',
                  gap: '12px',
                  padding: '12px 20px',
                  borderBottom: `1px solid ${T.border}`,
                  background: T.bg2,
                }}>
                  {['Post', 'Tags', 'Scheduled', 'Status'].map((h, i) => (
                    <div key={h} style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: T.text40,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      textAlign: i === 3 ? 'right' : 'left',
                    }}>{h}</div>
                  ))}
                </div>

                {posts.map((post, idx) => (
                  <div
                    key={post._id}
                    className="bs-post-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 160px 80px',
                      gap: '12px',
                      padding: '14px 20px',
                      alignItems: 'center',
                      borderBottom: idx < posts.length - 1 ? `1px solid ${T.border}` : 'none',
                    }}
                  >
                    {/* Title + meta */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: T.text100,
                        marginBottom: '3px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {post.title}
                      </div>
                      <div style={{ fontSize: '12px', color: T.text40 }}>
                        @{post.account_name}
                        {post.status === 'pending' && (
                          <span style={{ color: T.warning, marginLeft: '8px' }}>{getCountdown(post.scheduled_time)}</span>
                        )}
                        {post.status === 'done' && post.permlink && (
                          <a
                            href={`https://blurt.blog/@${post.account_name}/${post.permlink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: T.accent, marginLeft: '8px', textDecoration: 'none' }}
                          >
                            View on Blurt
                          </a>
                        )}
                        {post.status === 'failed' && post.error_message && (
                          <span style={{ color: T.danger, marginLeft: '8px' }}>{post.error_message}</span>
                        )}
                      </div>
                    </div>

                    {/* Tags */}
                    <div style={{ fontSize: '12px', color: T.text40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.tags}
                    </div>

                    {/* Scheduled time */}
                    <div style={{ fontSize: '12px', color: T.text60, whiteSpace: 'nowrap' }}>
                      {formatDate(post.scheduled_time)}
                    </div>

                    {/* Status + action */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                      {post.status === 'pending' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <StatusTag status={post.status} />
                          <button
                            className="bs-btn-danger-sm"
                            onClick={() => handleDelete(post._id)}
                            title="Cancel post"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                              <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                              <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <StatusTag status={post.status} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}