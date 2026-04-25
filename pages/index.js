import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  ListTodo, 
  Plus, 
  LogOut, 
  Upload, 
  Trash2, 
  ExternalLink,
  Zap,
  LayoutDashboard,
  FileText,
  AlertCircle,
  CheckCircle2,
  ClockIcon,
  XCircle,
  Image as ImageIcon,
  Send
} from 'lucide-react';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function statusBadge(status) {
  const styles = {
    pending: { bg: 'rgba(251, 191, 36, 0.1)', color: '#FBBF24', label: 'Pending', icon: ClockIcon },
    done:    { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981', label: 'Published', icon: CheckCircle2 },
    failed:  { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', label: 'Failed', icon: XCircle },
  };
  const s = styles[status] || styles.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium`} style={{ background: s.bg, color: s.color }}>
      <Icon size={12} />
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
        setFormSuccess(`Post scheduled for ${formatDate(form.scheduled_time)}`);
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
      body: JSON.stringify({
        username,
        imageBase64: base64,
        filename: file.name || 'image.png',
      }),
    });

    const data = await res.json();

    if (data.success) {
      const markdown = '\n\n' + data.markdown + '\n\n';

      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentBody = form.body;
        const newBody =
          currentBody.substring(0, start) +
          markdown +
          currentBody.substring(end);

        setForm(prev => ({ ...prev, body: newBody }));

        setTimeout(() => {
          textarea.focus();
          const newPos = start + markdown.length;
          textarea.setSelectionRange(newPos, newPos);
        }, 50);

      } else {
        setForm(prev => ({ ...prev, body: prev.body + markdown }));
      }

      setFormSuccess('Image uploaded!');
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
        setCronResult('No posts due yet — scheduled time not reached');
      } else if (data.published > 0) {
        setCronResult(`${data.published} post(s) published successfully!`);
        fetchPosts();
      } else if (data.failed > 0) {
        setCronResult(`${data.failed} post(s) failed — check My Posts for error`);
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
    if (diff <= 0) return 'Due now — click Publish Due Posts button!';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m remaining`;
    }
    return `${mins}m ${secs}s remaining`;
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A0F] via-[#0F1117] to-[#151821] flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
              <Calendar className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Blurt Scheduler</h1>
            <p className="text-gray-400 mt-2">Schedule posts on Blurt blockchain</p>
          </div>
          
          <div className="bg-[#1A1D24]/80 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Blurt Username</label>
                <input
                  className="w-full px-4 py-2.5 bg-[#0F1117] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  type="text"
                  placeholder="e.g. alice (without @)"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  autoComplete="off"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Posting Key (WIF)</label>
                <input
                  className="w-full px-4 py-2.5 bg-[#0F1117] border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  type="password"
                  placeholder="5xxxxxxxxxxxxxxxxxx..."
                  value={loginForm.postingKey}
                  onChange={(e) => setLoginForm({ ...loginForm, postingKey: e.target.value })}
                  autoComplete="off"
                  required
                />
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-900/30 p-2.5 rounded-lg">
                <AlertCircle size={14} />
                <span>Key is AES-256 encrypted before storage. Never stored plain text.</span>
              </div>
              
              {loginError && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                  <XCircle size={16} />
                  {loginError}
                </div>
              )}
              
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? 'Verifying on Blurt...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = posts.filter((p) => p.status === 'pending').length;
  const doneCount    = posts.filter((p) => p.status === 'done').length;
  const failedCount  = posts.filter((p) => p.status === 'failed').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0F] via-[#0F1117] to-[#151821]">
      <div className="max-w-6xl mx-auto p-6 lg:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-xl">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Blurt Scheduler</h1>
              <p className="text-gray-400 text-sm">@{username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-800 text-gray-300 rounded-xl transition-all duration-200 border border-gray-700/50"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Pending', value: pendingCount, color: '#FBBF24', icon: Clock },
            { label: 'Published', value: doneCount, color: '#10B981', icon: CheckCircle2 },
            { label: 'Failed', value: failedCount, color: '#EF4444', icon: XCircle },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#1A1D24]/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5 hover:border-gray-700/70 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                </div>
                <stat.icon size={28} style={{ color: stat.color, opacity: 0.7 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Manual Publish Card */}
        <div className="bg-[#1A1D24]/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5 mb-8 hover:border-gray-700/70 transition-all">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Zap size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Manual Publish</h3>
                <p className="text-gray-400 text-sm">For local testing — GitHub Actions handles auto-publish in production</p>
              </div>
            </div>
            <button
              onClick={handleTriggerCron}
              disabled={cronLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50"
            >
              <Send size={16} />
              {cronLoading ? 'Publishing...' : 'Publish Due Posts'}
            </button>
          </div>
          {cronResult && (
            <div className="mt-4 p-3 bg-gray-900/50 rounded-lg text-sm text-gray-300 border border-gray-800">
              {cronResult}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#1A1D24]/40 p-1 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'schedule' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <Plus size={16} />
            Schedule New Post
          </button>
          <button
            onClick={() => { setActiveTab('list'); fetchPosts(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'list' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            <ListTodo size={16} />
            My Posts ({posts.length})
          </button>
        </div>

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="bg-[#1A1D24]/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Create Scheduled Post</h2>
            <form onSubmit={handleSchedule} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Post Title *</label>
                <input
                  className="w-full px-4 py-2.5 bg-[#0F1117] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  type="text"
                  placeholder="My awesome Blurt post"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Post Content (Markdown supported) *</label>
                <textarea
                  ref={textareaRef}
                  className="w-full px-4 py-2.5 bg-[#0F1117] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-y"
                  rows={6}
                  placeholder="Write your post content here... Paste image directly (Ctrl+V) or use upload button below"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  onPaste={handlePaste}
                  required
                />
                <div className="flex items-center gap-3 mt-2">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 text-gray-300 text-sm rounded-lg cursor-pointer transition-all border border-gray-700">
                    <ImageIcon size={14} />
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])}
                    />
                  </label>
                  <span className="text-xs text-gray-500">Or paste directly with Ctrl+V</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tags (comma-separated)</label>
                <input
                  className="w-full px-4 py-2.5 bg-[#0F1117] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  type="text"
                  placeholder="blurt, life, photography"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Schedule Date & Time *</label>
                <input
                  className="w-full px-4 py-2.5 bg-[#0F1117] border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  type="datetime-local"
                  min={getMinDateTime()}
                  value={form.scheduled_time}
                  onChange={(e) => setForm({ ...form, scheduled_time: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Manual publish for local — auto every 10 min in production</p>
              </div>
              
              {formError && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">
                  <XCircle size={16} />
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 p-3 rounded-lg">
                  <CheckCircle2 size={16} />
                  {formSuccess}
                </div>
              )}
              
              <button
                type="submit"
                disabled={formLoading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50"
              >
                {formLoading ? 'Scheduling...' : 'Schedule Post'}
              </button>
            </form>
          </div>
        )}

        {/* Posts List Tab */}
        {activeTab === 'list' && (
          <div>
            {postsLoading ? (
              <div className="bg-[#1A1D24]/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-8 text-center">
                <div className="animate-pulse text-gray-400">Loading posts...</div>
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-[#1A1D24]/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800/50 rounded-2xl mb-4">
                  <FileText size={32} className="text-gray-500" />
                </div>
                <h3 className="text-xl font-medium text-white mb-2">No posts yet</h3>
                <p className="text-gray-400 mb-6">Schedule your first post to get started</p>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all"
                >
                  <Plus size={16} />
                  Create Post
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post._id} className="bg-[#1A1D24]/60 backdrop-blur-sm border border-gray-800/50 rounded-xl p-5 hover:border-gray-700/70 transition-all">
                    <div className="flex flex-col lg:flex-row justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <h3 className="font-semibold text-white text-lg truncate">{post.title}</h3>
                          <div className="flex items-center gap-2">
                            {statusBadge(post.status)}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                          <span className="text-gray-400">@{post.account_name}</span>
                          <span className="text-gray-500">·</span>
                          <span className="text-gray-400">Tags: {post.tags}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                          <Calendar size={14} />
                          {formatDate(post.scheduled_time)}
                        </div>
                        
                        {post.status === 'done' && post.permlink && (
                          <a
                            href={'https://blurt.blog/@' + post.account_name + '/' + post.permlink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm mt-2 transition-colors"
                          >
                            View on Blurt <ExternalLink size={12} />
                          </a>
                        )}
                        
                        {post.status === 'failed' && post.error_message && (
                          <div className="flex items-start gap-2 mt-2 text-sm text-red-400 bg-red-500/10 p-2 rounded-lg">
                            <AlertCircle size={14} className="mt-0.5" />
                            <span>Error: {post.error_message}</span>
                          </div>
                        )}
                      </div>
                      
                      {post.status === 'pending' && (
                        <div className="flex items-center justify-end">
                          <button 
                            onClick={() => handleDelete(post._id)} 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-all border border-red-500/20"
                          >
                            <Trash2 size={14} />
                            Cancel
                          </button>
                        </div>
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