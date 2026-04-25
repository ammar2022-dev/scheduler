import { useState, useEffect, useCallback, useRef } from 'react';

const COLORS = {
  bg: '#0a0a0f',
  surface: '#111118',
  surfaceHover: '#16161f',
  border: '#1e1e2e',
  borderFocus: '#3b3b5c',
  primary: '#5b6cf9',
  primaryHover: '#4a5be8',
  primaryMuted: 'rgba(91,108,249,0.12)',
  success: '#22c55e',
  successMuted: 'rgba(34,197,94,0.1)',
  danger: '#ef4444',
  dangerMuted: 'rgba(239,68,68,0.1)',
  warning: '#f59e0b',
  warningMuted: 'rgba(245,158,11,0.1)',
  text: '#e8e8f0',
  textSecondary: '#8888a8',
  textTertiary: '#4a4a6a',
};

const T = {
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sans: "'DM Sans', 'Geist', system-ui, sans-serif",
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function StatusBadge({ status }) {
  const map = {
    pending:  { bg: COLORS.warningMuted, color: COLORS.warning,  label: 'Pending'   },
    done:     { bg: COLORS.successMuted, color: COLORS.success,  label: 'Published' },
    failed:   { bg: COLORS.dangerMuted,  color: COLORS.danger,   label: 'Failed'    },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: s.bg,
      color: s.color,
      padding: '3px 10px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      fontFamily: T.mono,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: '5px', height: '5px',
        borderRadius: '50%',
        background: s.color,
        flexShrink: 0,
      }} />
      {s.label}
    </span>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: COLORS.border, margin: '0' }} />;
}

const css = {
  page: {
    minHeight: '100vh',
    background: COLORS.bg,
    fontFamily: T.sans,
    color: COLORS.text,
    WebkitFontSmoothing: 'antialiased',
  },
  sidebar: {
    width: '220px',
    minHeight: '100vh',
    background: COLORS.surface,
    borderRight: `1px solid ${COLORS.border}`,
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 10,
  },
  main: {
    marginLeft: '220px',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  topbar: {
    height: '56px',
    borderBottom: `1px solid ${COLORS.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    background: COLORS.surface,
    position: 'sticky',
    top: 0,
    zIndex: 9,
  },
  content: {
    padding: '32px',
    maxWidth: '860px',
  },
  card: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: '8px',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '6px',
    border: `1px solid ${COLORS.border}`,
    background: 'rgba(255,255,255,0.03)',
    color: COLORS.text,
    fontSize: '14px',
    fontFamily: T.sans,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: '6px',
    letterSpacing: '0.01em',
  },
  btnPrimary: {
    padding: '9px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '13px',
    fontFamily: T.sans,
    background: COLORS.primary,
    color: '#fff',
    transition: 'background 0.15s, opacity 0.15s',
    letterSpacing: '0.01em',
  },
  btnGhost: {
    padding: '7px 14px',
    borderRadius: '6px',
    border: `1px solid ${COLORS.border}`,
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '13px',
    fontFamily: T.sans,
    background: 'transparent',
    color: COLORS.textSecondary,
    transition: 'border-color 0.15s, color 0.15s',
  },
  btnDanger: {
    padding: '6px 12px',
    borderRadius: '5px',
    border: `1px solid rgba(239,68,68,0.25)`,
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '12px',
    fontFamily: T.sans,
    background: COLORS.dangerMuted,
    color: COLORS.danger,
    transition: 'opacity 0.15s',
  },
};

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', postingKey: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [form, setForm] = useState({ title: '', body: '', tags: 'blurt', scheduled_time: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronResult, setCronResult] = useState('');
  const [now, setNow] = useState(new Date());
  const textareaRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('blurt_user');
    if (saved) { setUsername(saved); setLoggedIn(true); }
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!username) return;
    setPostsLoading(true);
    try {
      const res = await fetch(`/api/posts?username=${encodeURIComponent(username)}`);
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
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginForm.username.trim(),
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
        setLoginError(data.error || 'Authentication failed');
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
      const res = await fetch('/api/schedule', {
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
        setFormSuccess(`Post scheduled for ${formatDate(form.scheduled_time)}`);
        setForm({ title: '', body: '', tags: 'blurt', scheduled_time: '' });
        fetchPosts();
        setTimeout(() => { setFormSuccess(''); setActiveTab('list'); }, 1500);
      } else {
        setFormError(data.error || 'Failed to schedule post');
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
      const res = await fetch(`/api/posts/${postId}?username=${encodeURIComponent(username)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.success) fetchPosts();
      else alert(data.error || 'Delete failed');
    } catch { alert('Network error'); }
  }

  async function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setFormError('');
    setFormSuccess('Uploading image...');
    try {
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, imageBase64: base64, filename: file.name || 'image.png' }),
      });
      const data = await res.json();
      if (data.success) {
        const markdown = '\n\n' + data.markdown + '\n\n';
        const textarea = textareaRef.current;
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newBody = form.body.substring(0, start) + markdown + form.body.substring(end);
          setForm(prev => ({ ...prev, body: newBody }));
          setTimeout(() => {
            textarea.focus();
            const newPos = start + markdown.length;
            textarea.setSelectionRange(newPos, newPos);
          }, 50);
        } else {
          setForm(prev => ({ ...prev, body: prev.body + markdown }));
        }
        setFormSuccess('Image uploaded successfully');
        setTimeout(() => setFormSuccess(''), 3000);
      } else {
        setFormError('Image upload failed: ' + data.error);
      }
    } catch (err) {
      setFormError('Image upload error: ' + err.message);
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
      const res = await fetch('/api/check-posts');
      const data = await res.json();
      if (data.message === 'No posts due') {
        setCronResult('No posts are due at this time.');
      } else if (data.published > 0) {
        setCronResult(`${data.published} post${data.published !== 1 ? 's' : ''} published successfully.`);
        fetchPosts();
      } else if (data.failed > 0) {
        setCronResult(`${data.failed} post${data.failed !== 1 ? 's' : ''} failed to publish.`);
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
    const d = new Date(Date.now() + 2 * 60 * 1000);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d - offset).toISOString().slice(0, 16);
  }

  function getCountdown(scheduledTime) {
    const diff = new Date(scheduledTime) - now;
    if (diff <= 0) return 'Due now';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m`;
    }
    return `${mins}m ${secs}s`;
  }

  // ── LOGIN SCREEN ────────────────────────────────────────────────────────────
  if (!loggedIn) {
    return (
      <div style={{
        ...css.page,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          input:focus { border-color: ${COLORS.primary} !important; }
          input::placeholder { color: ${COLORS.textTertiary}; }
          textarea:focus { border-color: ${COLORS.primary} !important; }
          textarea::placeholder { color: ${COLORS.textTertiary}; }
          button:hover:not(:disabled) { opacity: 0.88; }
          ::-webkit-scrollbar { width: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
        `}</style>

        <div style={{ width: '100%', maxWidth: '380px', padding: '24px' }}>

          {/* Brand mark */}
          <div style={{ marginBottom: '40px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px',
            }}>
              <div style={{
                width: '28px', height: '28px',
                background: COLORS.primary,
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="5" rx="1" fill="white" />
                  <rect x="8" y="1" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)" />
                  <rect x="1" y="8" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)" />
                  <rect x="8" y="8" width="5" height="5" rx="1" fill="white" />
                </svg>
              </div>
              <span style={{
                fontSize: '15px', fontWeight: '700', color: COLORS.text, letterSpacing: '-0.01em',
              }}>
                Blurt Scheduler
              </span>
            </div>
            <p style={{ fontSize: '13px', color: COLORS.textSecondary }}>
              Sign in to manage your scheduled posts
            </p>
          </div>

          <div style={{ ...css.card, padding: '28px' }}>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: '16px' }}>
                <label style={css.label}>Username</label>
                <input
                  style={css.input}
                  type="text"
                  placeholder="username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  autoComplete="off"
                  required
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={css.label}>Posting Key (WIF)</label>
                <input
                  style={css.input}
                  type="password"
                  placeholder="5K..."
                  value={loginForm.postingKey}
                  onChange={(e) => setLoginForm({ ...loginForm, postingKey: e.target.value })}
                  autoComplete="off"
                  required
                />
                <p style={{ fontSize: '11px', color: COLORS.textTertiary, marginTop: '6px' }}>
                  Encrypted with AES-256 before storage
                </p>
              </div>

              {loginError && (
                <div style={{
                  padding: '10px 12px',
                  background: COLORS.dangerMuted,
                  border: `1px solid rgba(239,68,68,0.2)`,
                  borderRadius: '6px',
                  color: COLORS.danger,
                  fontSize: '13px',
                  marginBottom: '16px',
                }}>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                style={{ ...css.btnPrimary, width: '100%', opacity: loginLoading ? 0.6 : 1 }}
              >
                {loginLoading ? 'Authenticating...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── DASHBOARD ───────────────────────────────────────────────────────────────
  const pendingCount = posts.filter(p => p.status === 'pending').length;
  const doneCount    = posts.filter(p => p.status === 'done').length;
  const failedCount  = posts.filter(p => p.status === 'failed').length;

  const navItems = [
    {
      key: 'schedule',
      label: 'New Post',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      key: 'list',
      label: 'Scheduled Posts',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor"/>
          <rect x="1" y="6.25" width="12" height="1.5" rx="0.75" fill="currentColor"/>
          <rect x="1" y="10.5" width="8" height="1.5" rx="0.75" fill="currentColor"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ ...css.page, display: 'flex' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: ${COLORS.primary} !important; outline: none; }
        input::placeholder { color: ${COLORS.textTertiary}; }
        textarea:focus { border-color: ${COLORS.primary} !important; outline: none; }
        textarea::placeholder { color: ${COLORS.textTertiary}; }
        button:hover:not(:disabled) { opacity: 0.85; cursor: pointer; }
        button:disabled { cursor: not-allowed; }
        a { text-decoration: none; }
        a:hover { text-decoration: underline; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
      `}</style>

      {/* Sidebar */}
      <aside style={css.sidebar}>
        {/* Brand */}
        <div style={{ padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{
              width: '26px', height: '26px',
              background: COLORS.primary,
              borderRadius: '5px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="white" />
                <rect x="8" y="1" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)" />
                <rect x="1" y="8" width="5" height="5" rx="1" fill="rgba(255,255,255,0.5)" />
                <rect x="8" y="8" width="5" height="5" rx="1" fill="white" />
              </svg>
            </div>
            <span style={{ fontSize: '13px', fontWeight: '700', color: COLORS.text, letterSpacing: '-0.01em' }}>
              Blurt Scheduler
            </span>
          </div>
        </div>

        <Divider />

        {/* Account chip */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '6px',
            border: `1px solid ${COLORS.border}`,
          }}>
            <div style={{
              width: '22px', height: '22px',
              borderRadius: '50%',
              background: COLORS.primaryMuted,
              border: `1px solid ${COLORS.primary}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '10px', fontWeight: '700', color: COLORS.primary }}>
                {username[0]?.toUpperCase()}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: COLORS.text, fontFamily: T.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{username}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '4px 12px', flex: 1 }}>
          {navItems.map(item => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  if (item.key === 'list') fetchPosts();
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  width: '100%', padding: '8px 10px',
                  borderRadius: '5px', border: 'none',
                  cursor: 'pointer',
                  background: isActive ? COLORS.primaryMuted : 'transparent',
                  color: isActive ? COLORS.primary : COLORS.textSecondary,
                  fontSize: '13px', fontWeight: isActive ? '600' : '500',
                  fontFamily: T.sans,
                  marginBottom: '2px',
                  textAlign: 'left',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {item.icon}
                {item.label}
                {item.key === 'list' && posts.length > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: '10px', fontWeight: '600',
                    background: isActive ? COLORS.primary : COLORS.border,
                    color: isActive ? '#fff' : COLORS.textSecondary,
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontFamily: T.mono,
                  }}>
                    {posts.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div style={{ padding: '16px 12px' }}>
          <Divider />
          <button
            onClick={handleLogout}
            style={{
              ...css.btnGhost,
              width: '100%',
              marginTop: '12px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3M9 10l3-3-3-3M13 7H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={css.main}>
        {/* Topbar */}
        <header style={css.topbar}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: '600', color: COLORS.text }}>
              {activeTab === 'schedule' ? 'New Post' : 'Scheduled Posts'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleTriggerCron}
              disabled={cronLoading}
              style={{
                ...css.btnGhost,
                fontSize: '12px',
                opacity: cronLoading ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M10 6A4 4 0 112 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M10 3v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {cronLoading ? 'Publishing...' : 'Publish Due'}
            </button>
          </div>
        </header>

        {/* Cron result banner */}
        {cronResult && (
          <div style={{
            padding: '10px 32px',
            background: cronResult.includes('Error') || cronResult.includes('failed') ? COLORS.dangerMuted : COLORS.successMuted,
            borderBottom: `1px solid ${cronResult.includes('Error') || cronResult.includes('failed') ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}`,
            color: cronResult.includes('Error') || cronResult.includes('failed') ? COLORS.danger : COLORS.success,
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>{cronResult}</span>
            <button onClick={() => setCronResult('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '14px', opacity: 0.7 }}>x</button>
          </div>
        )}

        <div style={css.content}>

          {/* Stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '28px',
          }}>
            {[
              { label: 'Pending',   value: pendingCount, color: COLORS.warning  },
              { label: 'Published', value: doneCount,    color: COLORS.success  },
              { label: 'Failed',    value: failedCount,  color: COLORS.danger   },
            ].map(s => (
              <div key={s.label} style={{
                ...css.card,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: '12px', color: COLORS.textSecondary, fontWeight: '500' }}>{s.label}</span>
                <span style={{ fontSize: '22px', fontWeight: '700', color: s.color, fontFamily: T.mono }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* ── Schedule Tab ── */}
          {activeTab === 'schedule' && (
            <div style={css.card}>
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${COLORS.border}` }}>
                <h2 style={{ fontSize: '14px', fontWeight: '600', color: COLORS.text }}>Create Post</h2>
                <p style={{ fontSize: '12px', color: COLORS.textSecondary, marginTop: '2px' }}>
                  Compose and schedule a new post to the Blurt blockchain.
                </p>
              </div>

              <div style={{ padding: '24px' }}>
                <form onSubmit={handleSchedule}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={css.label}>Title</label>
                    <input
                      style={css.input}
                      type="text"
                      placeholder="Post title"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <label style={css.label}>Content</label>
                    <textarea
                      ref={textareaRef}
                      style={{ ...css.input, height: '180px', resize: 'vertical', lineHeight: '1.6', fontFamily: T.mono, fontSize: '13px' }}
                      placeholder="Write in Markdown. Paste images directly with Ctrl+V."
                      value={form.body}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                      onPaste={handlePaste}
                      required
                    />
                  </div>

                  {/* Image upload */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: 'transparent',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: '5px',
                      color: COLORS.textSecondary,
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontFamily: T.sans,
                      fontWeight: '500',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                        <circle cx="4" cy="4.5" r="1" fill="currentColor"/>
                        <path d="M1 8l3-3 2 2 2-2 3 3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                      </svg>
                      Attach image
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])}
                      />
                    </label>
                    <span style={{ fontSize: '11px', color: COLORS.textTertiary, marginLeft: '10px' }}>
                      or paste with Ctrl+V
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <label style={css.label}>Tags</label>
                      <input
                        style={css.input}
                        type="text"
                        placeholder="blurt, photography, life"
                        value={form.tags}
                        onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={css.label}>Scheduled Time</label>
                      <input
                        style={{ ...css.input, colorScheme: 'dark' }}
                        type="datetime-local"
                        min={getMinDateTime()}
                        value={form.scheduled_time}
                        onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {formError && (
                    <div style={{
                      padding: '10px 12px',
                      background: COLORS.dangerMuted,
                      border: `1px solid rgba(239,68,68,0.2)`,
                      borderRadius: '6px',
                      color: COLORS.danger,
                      fontSize: '13px',
                      marginBottom: '16px',
                    }}>
                      {formError}
                    </div>
                  )}

                  {formSuccess && (
                    <div style={{
                      padding: '10px 12px',
                      background: COLORS.successMuted,
                      border: `1px solid rgba(34,197,94,0.2)`,
                      borderRadius: '6px',
                      color: COLORS.success,
                      fontSize: '13px',
                      marginBottom: '16px',
                    }}>
                      {formSuccess}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={formLoading}
                      style={{ ...css.btnPrimary, opacity: formLoading ? 0.6 : 1 }}
                    >
                      {formLoading ? 'Scheduling...' : 'Schedule Post'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── Posts List Tab ── */}
          {activeTab === 'list' && (
            <div>
              {postsLoading ? (
                <div style={{
                  ...css.card,
                  padding: '48px',
                  textAlign: 'center',
                  color: COLORS.textSecondary,
                  fontSize: '13px',
                }}>
                  Loading posts...
                </div>
              ) : posts.length === 0 ? (
                <div style={{
                  ...css.card,
                  padding: '60px 32px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: '40px', height: '40px',
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <rect x="2" y="2" width="14" height="14" rx="2" stroke={COLORS.textTertiary} strokeWidth="1.3"/>
                      <path d="M5 9h8M5 6h5" stroke={COLORS.textTertiary} strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: COLORS.text, marginBottom: '4px' }}>No posts scheduled</p>
                  <p style={{ fontSize: '13px', color: COLORS.textSecondary, marginBottom: '20px' }}>
                    Create your first scheduled post to get started.
                  </p>
                  <button
                    onClick={() => setActiveTab('schedule')}
                    style={css.btnPrimary}
                  >
                    Create Post
                  </button>
                </div>
              ) : (
                <div style={css.card}>
                  {/* Table header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 160px 80px 60px',
                    gap: '16px',
                    padding: '10px 20px',
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}>
                    {['Title', 'Status', 'Scheduled', 'Countdown', ''].map((h, i) => (
                      <div key={i} style={{
                        fontSize: '11px', fontWeight: '600',
                        color: COLORS.textTertiary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontFamily: T.mono,
                        textAlign: i === 4 ? 'right' : 'left',
                      }}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {posts.map((post, idx) => {
                    const countdown = getCountdown(post.scheduled_time);
                    const isDue = new Date(post.scheduled_time) <= now;
                    return (
                      <div key={post._id}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 120px 160px 80px 60px',
                          gap: '16px',
                          padding: '14px 20px',
                          alignItems: 'center',
                          transition: 'background 0.1s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceHover}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Title col */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px', fontWeight: '600',
                              color: COLORS.text,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              marginBottom: '2px',
                            }}>
                              {post.title}
                            </div>
                            <div style={{ fontSize: '11px', color: COLORS.textTertiary, fontFamily: T.mono }}>
                              {post.tags}
                            </div>
                            {post.status === 'done' && post.permlink && (
                              <a
                                href={`https://blurt.blog/@${post.account_name}/${post.permlink}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: COLORS.primary, fontSize: '11px', display: 'block', marginTop: '2px' }}
                              >
                                View post
                              </a>
                            )}
                            {post.status === 'failed' && post.error_message && (
                              <div style={{ color: COLORS.danger, fontSize: '11px', marginTop: '2px' }}>
                                {post.error_message}
                              </div>
                            )}
                          </div>

                          {/* Status */}
                          <div><StatusBadge status={post.status} /></div>

                          {/* Scheduled */}
                          <div style={{ fontSize: '12px', color: COLORS.textSecondary, fontFamily: T.mono }}>
                            {formatDate(post.scheduled_time)}
                          </div>

                          {/* Countdown */}
                          <div style={{
                            fontSize: '11px',
                            fontFamily: T.mono,
                            color: isDue && post.status === 'pending' ? COLORS.warning : COLORS.textTertiary,
                            fontWeight: isDue && post.status === 'pending' ? '600' : '400',
                          }}>
                            {post.status === 'pending' ? countdown : '—'}
                          </div>

                          {/* Actions */}
                          <div style={{ textAlign: 'right' }}>
                            {post.status === 'pending' && (
                              <button onClick={() => handleDelete(post._id)} style={css.btnDanger}>
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                        {idx < posts.length - 1 && <Divider />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}