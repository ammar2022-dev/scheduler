import { useState, useEffect, useCallback } from 'react';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusBadge(status) {
  const styles = {
    pending: { bg: '#fff3cd', color: '#856404', label: '⏳ Pending' },
    done:    { bg: '#d4edda', color: '#155724', label: '✅ Published' },
    failed:  { bg: '#f8d7da', color: '#721c24', label: '❌ Failed' },
  };
  const s = styles[status] || styles.pending;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: '12px',
      fontSize: '12px', fontWeight: '600',
    }}>
      {s.label}
    </span>
  );
}

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

  // Live clock for countdown
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
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
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
      setFormError('Title, body, and scheduled time required.');
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
        setFormSuccess(`✅ Post scheduled for ${formatDate(form.scheduled_time)}`);
        setForm({ title: '', body: '', tags: 'blurt', scheduled_time: '' });
        fetchPosts();
        setTimeout(() => setActiveTab('list'), 1500);
      } else {
        setFormError(data.error || 'Failed to schedule');
      }
    } catch (err) {
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
    } catch (err) { alert('Network error'); }
  }

  async function handleTriggerCron() {
    setCronLoading(true);
    setCronResult('');
    try {
      const res = await fetch('/api/check-posts');
      const data = await res.json();
      if (data.message === 'No posts due') {
        setCronResult('⏳ No posts due yet — scheduled time not reached');
      } else if (data.published > 0) {
        setCronResult(`✅ ${data.published} post(s) published successfully!`);
        fetchPosts();
      } else if (data.failed > 0) {
        setCronResult(`❌ ${data.failed} post(s) failed — check My Posts for error`);
        fetchPosts();
      } else {
        setCronResult(JSON.stringify(data));
      }
    } catch (err) {
      setCronResult('❌ Error: ' + err.message);
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
    if (diff <= 0) return '🔴 Due now — click Publish Due Posts button!';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `⏱ ${hrs}h ${remainMins}m remaining`;
    }
    return `⏱ ${mins}m ${secs}s remaining`;
  }

  const css = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      fontFamily: "'Segoe UI', sans-serif",
      color: '#e0e0e0',
      padding: '20px',
    },
    card: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px',
      padding: '28px',
      backdropFilter: 'blur(10px)',
    },
    input: {
      width: '100%',
      padding: '11px 14px',
      borderRadius: '10px',
      border: '1px solid rgba(255,255,255,0.15)',
      background: 'rgba(255,255,255,0.07)',
      color: '#fff',
      fontSize: '15px',
      outline: 'none',
      boxSizing: 'border-box',
      marginTop: '6px',
    },
    label: {
      display: 'block',
      fontSize: '13px',
      color: '#aaa',
      marginBottom: '2px',
      marginTop: '14px',
    },
    btn: {
      padding: '12px 24px',
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '700',
      fontSize: '15px',
    },
    btnPrimary: {
      background: 'linear-gradient(90deg, #4f8ef7, #7c3aed)',
      color: '#fff',
    },
    btnDanger: {
      background: 'rgba(220,53,69,0.2)',
      color: '#ff6b6b',
      border: '1px solid rgba(220,53,69,0.4)',
      padding: '6px 14px',
      fontSize: '13px',
      borderRadius: '8px',
      cursor: 'pointer',
    },
    tab: (active) => ({
      padding: '10px 22px',
      borderRadius: '10px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px',
      background: active ? 'rgba(79,142,247,0.3)' : 'transparent',
      color: active ? '#4f8ef7' : '#888',
      borderBottom: active ? '2px solid #4f8ef7' : '2px solid transparent',
    }),
    error: {
      color: '#ff6b6b',
      fontSize: '14px',
      marginTop: '10px',
      padding: '10px',
      background: 'rgba(255,107,107,0.1)',
      borderRadius: '8px',
    },
    success: {
      color: '#6fcf97',
      fontSize: '14px',
      marginTop: '10px',
      padding: '10px',
      background: 'rgba(111,207,151,0.1)',
      borderRadius: '8px',
    },
  };

  // LOGIN SCREEN
  if (!loggedIn) {
    return (
      <div style={css.page}>
        <div style={{ maxWidth: '420px', margin: '80px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🌀</div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: '#fff' }}>
              Blurt Scheduler
            </h1>
            <p style={{ color: '#888', margin: '6px 0 0' }}>
              Schedule posts on Blurt blockchain
            </p>
          </div>
          <div style={css.card}>
            <form onSubmit={handleLogin}>
              <label style={css.label}>Blurt Username</label>
              <input
                style={css.input}
                type="text"
                placeholder="e.g. alice (without @)"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                autoComplete="off"
                required
              />
              <label style={css.label}>Posting Key (WIF)</label>
              <input
                style={css.input}
                type="password"
                placeholder="5xxxxxxxxxxxxxxxxxx..."
                value={loginForm.postingKey}
                onChange={(e) => setLoginForm({ ...loginForm, postingKey: e.target.value })}
                autoComplete="off"
                required
              />
              <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                🔒 Key is AES-256 encrypted before storage. Never stored plain text.
              </p>
              {loginError && <div style={css.error}>{loginError}</div>}
              <button
                type="submit"
                disabled={loginLoading}
                style={{ ...css.btn, ...css.btnPrimary, width: '100%', marginTop: '18px', opacity: loginLoading ? 0.7 : 1 }}
              >
                {loginLoading ? '⏳ Verifying on Blurt...' : '🚀 Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD
  const pendingCount = posts.filter((p) => p.status === 'pending').length;
  const doneCount    = posts.filter((p) => p.status === 'done').length;
  const failedCount  = posts.filter((p) => p.status === 'failed').length;

  return (
    <div style={css.page}>
      <div style={{ maxWidth: '780px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', color: '#fff' }}>🌀 Blurt Scheduler</h1>
            <p style={{ margin: '4px 0 0', color: '#4f8ef7', fontSize: '14px' }}>@{username}</p>
          </div>
          <button
            onClick={handleLogout}
            style={{ ...css.btn, background: 'rgba(255,255,255,0.08)', color: '#ccc', fontSize: '13px', padding: '8px 18px' }}
          >
            Logout
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Pending',   value: pendingCount, color: '#f6c90e' },
            { label: 'Published', value: doneCount,    color: '#6fcf97' },
            { label: 'Failed',    value: failedCount,  color: '#ff6b6b' },
          ].map((s) => (
            <div key={s.label} style={{ ...css.card, textAlign: 'center', padding: '16px' }}>
              <div style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Manual Publish Trigger */}
        <div style={{ ...css.card, marginBottom: '20px', padding: '16px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>🚀 Manual Publish</div>
              <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>
                Local testing ke liye — production mein GitHub Actions automatically karega
              </div>
            </div>
            <button
              onClick={handleTriggerCron}
              disabled={cronLoading}
              style={{ ...css.btn, ...css.btnPrimary, fontSize: '13px', padding: '9px 20px', opacity: cronLoading ? 0.7 : 1 }}
            >
              {cronLoading ? '⏳ Publishing...' : '▶ Publish Due Posts'}
            </button>
          </div>
          {cronResult && (
            <div style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', fontSize: '13px', color: '#e0e0e0' }}>
              {cronResult}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
          <button style={css.tab(activeTab === 'schedule')} onClick={() => setActiveTab('schedule')}>
            ✏️ Schedule New Post
          </button>
          <button style={css.tab(activeTab === 'list')} onClick={() => { setActiveTab('list'); fetchPosts(); }}>
            📋 My Posts ({posts.length})
          </button>
        </div>

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div style={css.card}>
            <h2 style={{ margin: '0 0 20px', fontSize: '18px', color: '#fff' }}>Create Scheduled Post</h2>
            <form onSubmit={handleSchedule}>
              <label style={css.label}>Post Title *</label>
              <input
                style={css.input}
                type="text"
                placeholder="My awesome Blurt post"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <label style={css.label}>Post Content (Markdown supported) *</label>
              <textarea
                style={{ ...css.input, height: '160px', resize: 'vertical', lineHeight: '1.5' }}
                placeholder="Write your post content here..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
              />
              <label style={css.label}>Tags (comma-separated)</label>
              <input
                style={css.input}
                type="text"
                placeholder="blurt, life, photography"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
              <label style={css.label}>Schedule Date & Time *</label>
              <input
                style={css.input}
                type="datetime-local"
                min={getMinDateTime()}
                value={form.scheduled_time}
                onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                required
              />
              <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0' }}>
                ⏰ Local pe manually publish karo — production mein auto hoga har 10 min
              </p>
              {formError   && <div style={css.error}>{formError}</div>}
              {formSuccess && <div style={css.success}>{formSuccess}</div>}
              <button
                type="submit"
                disabled={formLoading}
                style={{ ...css.btn, ...css.btnPrimary, marginTop: '20px', opacity: formLoading ? 0.7 : 1 }}
              >
                {formLoading ? '⏳ Scheduling...' : '📅 Schedule Post'}
              </button>
            </form>
          </div>
        )}

        {/* Posts List Tab */}
        {activeTab === 'list' && (
          <div>
            {postsLoading ? (
              <div style={{ ...css.card, textAlign: 'center', color: '#888' }}>Loading posts...</div>
            ) : posts.length === 0 ? (
              <div style={{ ...css.card, textAlign: 'center', color: '#888' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <p>No posts yet. Schedule your first post!</p>
                <button
                  onClick={() => setActiveTab('schedule')}
                  style={{ ...css.btn, ...css.btnPrimary, marginTop: '8px' }}
                >
                  Create Post
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {posts.map((post) => (
                  <div key={post._id} style={{ ...css.card, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ fontWeight: '700', fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
                          {post.title}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                          @{post.account_name} · Tags: {post.tags}
                        </div>
                        <div style={{ fontSize: '13px', color: '#aaa' }}>
                          📅 {formatDate(post.scheduled_time)}
                        </div>
                                       {post.status === 'done' && post.permlink && (
                          <a
                            href={'https://blurt.blog/@' + post.account_name + '/' + post.permlink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#4f8ef7', fontSize: '12px', marginTop: '4px', display: 'block' }}
                          >
                            View on Blurt
                          </a>
                        )}
                        
                        {post.status === 'failed' && post.error_message && (
                          <div style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '4px' }}>
                            Error: {post.error_message}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        {statusBadge(post.status)}
                        {post.status === 'pending' && (
                          <button onClick={() => handleDelete(post._id)} style={css.btnDanger}>
                            🗑 Cancel
                          </button>
                        )}
                      </div>
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