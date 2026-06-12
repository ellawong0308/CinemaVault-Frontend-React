import React, { useState, useEffect, useRef } from 'react';

interface Movie {
  id: number;
  title: string;
  genre: string;
  year: number;
  director: string;
}

interface User {
  username: string;
  role: string;
  profile_photo: string | null;
}

interface DBMessage {
  id: number;
  username: string;
  title: string;
  content: string;
  reply: string | null;
  created_at: string;
}

const API_BASE_URL = "http://localhost:10888/api/v1";
// 🌟 請記得換成你真實的 Google Client ID
const GOOGLE_CLIENT_ID = "479961485296-bc9qtqof14lj1jv3soqs07qqbqi46hoi.apps.googleusercontent.com"; 

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]); 
  const [loadingMovies, setLoadingMovies] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<'all' | 'favorites' | 'messages'>('all');

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [avatarScale, setAvatarScale] = useState<number>(1.0);

  // ✉️ Direct Message 狀態管理
  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [msgTitle, setMsgTitle] = useState<string>('');
  const [msgContent, setMsgContent] = useState<string>('');
  const [adminReplies, setAdminReplies] = useState<{ [key: number]: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMovies();

    const savedToken = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");
    const savedPhoto = localStorage.getItem("profile_photo");

    if (savedToken && savedUsername && savedRole) {
      setToken(savedToken);
      setUser({
        username: savedUsername,
        role: savedRole,
        profile_photo: savedPhoto && savedPhoto !== "null" ? savedPhoto : null
      });
      fetchFavoriteIds(savedToken);
    }
    initGoogleSignIn();
  }, []);

  useEffect(() => {
    if (isModalOpen && authMode === 'login') {
      renderGoogleButton();
    }
  }, [isModalOpen, authMode]);

  // 當切換到訊息分頁，且使用者是 admin 時，自動抓取所有信件
  useEffect(() => {
    if (currentTab === 'messages' && user?.role === 'admin' && token) {
      fetchAdminMessages();
    }
  }, [currentTab, user, token]);

  const fetchMovies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/movies`);
      const data = await response.json();
      setMovies(data);
    } catch (error) {
      console.error("Error loading movies:", error);
    } finally {
      setLoadingMovies(false);
    }
  };

  const fetchFavoriteIds = async (userToken: string) => {
    if (!userToken) return;
    try {
      const response = await fetch(`${API_BASE_URL}/movies/favorites`, {
        headers: { "Authorization": `Bearer ${userToken}` }
      });
      if (response.ok) {
        const favMovies: Movie[] = await response.json();
        setFavoriteIds(favMovies.map(m => m.id));
      }
    } catch (error) {
      console.error("Error fetching favorite ids:", error);
    }
  };

  // ✉️ 獲取後台所有信件 (Admin Only)
  const fetchAdminMessages = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/messages`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  // ✉️ 會員提交信件表單
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: msgTitle, content: msgContent })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      alert("✉️ Your message has been sent to Admin safely!");
      setMsgTitle('');
      setMsgContent('');
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  // ✉️ 管理員提交回覆
  const handleAdminReply = async (msgId: number) => {
    const replyText = adminReplies[msgId];
    if (!replyText || !replyText.trim()) {
      alert("Please enter reply text first.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/messages/${msgId}/reply`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reply: replyText })
      });
      if (!res.ok) throw new Error("Reply failed");
      alert("💬 Reply submitted successfully!");
      fetchAdminMessages(); // 重新整理清單
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  // ✉️ 管理員刪除信件
  const handleAdminDeleteMessage = async (msgId: number) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/messages/${msgId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Delete failed");
      alert("🗑️ Message removed.");
      fetchAdminMessages();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleToggleFavorite = async (movieId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) {
      alert("🔒 Please log in first to use favorites!");
      setIsModalOpen(true);
      setAuthMode('login');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/movies/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ movieId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Operation failed");

      if (data.isFavorite) {
        setFavoriteIds(prev => [...prev, movieId]);
      } else {
        setFavoriteIds(prev => prev.filter(id => id !== movieId));
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requestBody = { username: usernameInput.trim(), password: passwordInput };

    try {
      if (authMode === 'register') {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");

        alert("🎉 Registration Successful! Shifting to login mode...");
        setAuthMode('login');
        setPasswordInput('');
      } else {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");

        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.user.username);
        localStorage.setItem("role", data.user.role);
        localStorage.setItem("profile_photo", data.user.profile_photo || "null");

        setToken(data.token);
        setUser({
          username: data.user.username,
          role: data.user.role,
          profile_photo: data.user.profile_photo || null
        });

        fetchFavoriteIds(data.token);
        alert(`👋 Welcome back, ${data.user.username}!`);
        setIsModalOpen(false);
        resetAuthForm();
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    setFavoriteIds([]); 
    setCurrentTab('all'); 
    alert("🔒 Logged out successfully!");
  };

  const handleAvatarClick = () => { fileInputRef.current?.click(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await fetch(`${API_BASE_URL}/user/profile-photo`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to upload photo");

      localStorage.setItem("profile_photo", data.photoUrl);
      setUser(prev => prev ? { ...prev, profile_photo: data.photoUrl } : null);
      alert("📸 Profile photo updated successfully!");
    } catch (error: any) {
      alert(`❌ Upload Failed: ${error.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const initGoogleSignIn = () => {
    const anyWindow = window as any;
    if (anyWindow.google) {
      anyWindow.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse
      });
    }
  };

  const renderGoogleButton = () => {
    const anyWindow = window as any;
    setTimeout(() => {
      const btnContainer = document.getElementById("googleSignInButtonReact");
      if (anyWindow.google && btnContainer) {
        anyWindow.google.accounts.id.renderButton(
          btnContainer,
          { theme: "outline", size: "large", width: "320" }
        );
      }
    }, 100);
  };

  const handleGoogleCredentialResponse = async (response: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google authentication failed");

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.user.username);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("profile_photo", data.user.profile_photo || "null");

      setToken(data.token);
      setUser({
        username: data.user.username,
        role: data.user.role,
        profile_photo: data.user.profile_photo || null
      });

      fetchFavoriteIds(data.token);
      alert(`🎉 Google Login Successful! Welcome, ${data.user.username}`);
      setIsModalOpen(false);
      resetAuthForm();
    } catch (err: any) {
      alert(`❌ Google Auth Error: ${err.message}`);
    }
  };

  const resetAuthForm = () => {
    setUsernameInput('');
    setPasswordInput('');
  };

  const displayedMovies = currentTab === 'all' 
    ? movies 
    : movies.filter(movie => favoriteIds.includes(movie.id));

  return (
    <div>
      {/* 導覽列 (Navbar) */}
      <header className="navbar">
        <div className="logo" onClick={() => setCurrentTab('all')} style={{ cursor: 'pointer' }}>🎬 CinemaVault</div>
        <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          
          <button 
            onClick={() => setCurrentTab('all')} 
            style={{ background: 'none', border: 'none', color: currentTab === 'all' ? '#e50914' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
          >
            Home
          </button>

          {user && user.role !== 'admin' && (
            <button 
              onClick={() => setCurrentTab('favorites')} 
              style={{ background: 'none', border: 'none', color: currentTab === 'favorites' ? '#e50914' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
            >
              My Favorites ❤️ ({favoriteIds.length})
            </button>
          )}

          {/* 🌟 聯絡管理員 / 後台管理按鈕 */}
          {user && (
            <button 
              onClick={() => setCurrentTab('messages')} 
              style={{ background: 'none', border: 'none', color: currentTab === 'messages' ? '#e50914' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
            >
              {user.role === 'admin' ? '📩 Customer Messages' : '✉️ Contact Admin'}
            </button>
          )}
          
          {user && (
            <div 
              onClick={handleAvatarClick}
              onMouseEnter={() => setAvatarScale(1.1)}
              onMouseLeave={() => setAvatarScale(1.0)}
              style={{ display: 'flex', alignItems: 'center', position: 'relative', cursor: 'pointer' }}
              title="Click to upload profile photo"
            >
              <img 
                src={user.profile_photo ? `http://localhost:10888${user.profile_photo}` : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5-4-8-4z'/></svg>"} 
                alt="Avatar" 
                style={{ 
                  width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover', 
                  border: '2px solid #e50914', backgroundColor: '#333',
                  transform: `scale(${avatarScale})`, transition: 'transform 0.2s'
                }}
              />
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
            </div>
          )}

          <span className="user-info">
            {user ? `Hello, ${user.username} (${user.role.toUpperCase()})` : ''}
          </span>
          
          <button 
            onClick={() => user ? handleLogout() : { ...setIsModalOpen(true), ...setAuthMode('login') }} 
            style={{ backgroundColor: user ? '#333' : '#e50914', border: 'none', color: 'white', cursor: 'pointer', padding: '8px 16px', borderRadius: '4px' }}
          >
            {user ? 'Logout' : 'Login'}
          </button>
        </nav>
      </header>

      {/* Hero 區塊 */}
      <section className="hero">
        <h1>
          {currentTab === 'all' && 'Welcome to CinemaVault'}
          {currentTab === 'favorites' && 'Your Personal Collection'}
          {currentTab === 'messages' && (user?.role === 'admin' ? 'Message Control Center' : 'Contact Support')}
        </h1>
        <p>
          {currentTab === 'all' && 'Explore current movies, showtimes, and book your tickets seamlessly.'}
          {currentTab === 'favorites' && 'All your curated and loved films kept in one single safe vault.'}
          {currentTab === 'messages' && (user?.role === 'admin' ? 'Review questions and reply to CinemaVault members.' : 'Have any feedback or questions? Drop a mail directly to our Admin group.')}
        </p>
      </section>

      {/* 主內容渲染區區塊 */}
      <main className="container">
        {currentTab !== 'messages' ? (
          <>
            <h2 className="section-title">
              {currentTab === 'all' ? 'Now Showing' : '❤️ My Favorite Movies'}
            </h2>
            <div className="movie-grid">
              {loadingMovies ? (
                <div className="loading">Loading movies from database...</div>
              ) : displayedMovies.length === 0 ? (
                <div className="loading" style={{ color: '#aaa', fontSize: '18px', gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
                  {currentTab === 'all' ? '🍿 No movies found.' : '💔 You haven\'t favorited any movies yet.'}
                </div>
              ) : (
                displayedMovies.map((movie) => {
                  const isFav = favoriteIds.includes(movie.id);
                  return (
                    <div key={movie.id} className="movie-card" style={{ position: 'relative' }}>
                      {user?.role !== 'admin' && (
                        <button
                          onClick={(e) => handleToggleFavorite(movie.id, e)}
                          style={{
                            position: 'absolute', top: '15px', right: '15px',
                            background: 'rgba(0, 0, 0, 0.6)', border: 'none',
                            borderRadius: '50%', width: '36px', height: '36px',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: '18px', zIndex: 10,
                            color: isFav ? '#e50914' : '#fff'
                          }}
                        >
                          {isFav ? '❤️' : '🤍'}
                        </button>
                      )}
                      <div className="movie-info">
                        <span className="movie-tag">{movie.genre}</span>
                        <h3 className="movie-title">{movie.title}</h3>
                        <div className="movie-details">
                          <p><strong>Director:</strong> {movie.director}</p>
                          <p><strong>Release Year:</strong> {movie.year}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* 🌟 聯絡管理員分頁：依照角色動態切換 UI */
          <div style={{ maxWidth: '800px', margin: '0 auto', color: '#fff', padding: '20px', background: '#181818', borderRadius: '8px' }}>
            {user?.role !== 'admin' ? (
              /* A. 普通會員介面：顯示寄信表單 */
              <div>
                <h3 style={{ borderBottom: '2px solid #e50914', paddingBottom: '10px' }}>✉️ Send Direct Message to Admin</h3>
                <form onSubmit={handleSendMessage} style={{ marginTop: '20px' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Subject / Title</label>
                    <input 
                      type="text" 
                      value={msgTitle} 
                      onChange={(e) => setMsgTitle(e.target.value)}
                      placeholder="Enter mail subject..."
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff' }}
                      required 
                    />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Message Body</label>
                    <textarea 
                      value={msgContent} 
                      onChange={(e) => setMsgContent(e.target.value)}
                      placeholder="Type your message here..."
                      rows={6}
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#222', color: '#fff', resize: 'vertical' }}
                      required 
                    />
                  </div>
                  <button type="submit" style={{ backgroundColor: '#e50914', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Submit Ticket
                  </button>
                </form>
              </div>
            ) : (
              /* B. 管理員後台介面：列出信件、回覆與刪除 */
              <div>
                <h3 style={{ borderBottom: '2px solid #e50914', paddingBottom: '10px' }}>📩 Customer Tickets Inbox ({messages.length})</h3>
                {messages.length === 0 ? (
                  <p style={{ padding: '20px 0', color: '#aaa' }}>📭 Inbox is clean. No customer requests yet.</p>
                ) : (
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {messages.map((msg) => (
                      <div key={msg.id} style={{ background: '#222', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #e50914' }}>
                        <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 'bold', color: '#e50914' }}>From: {msg.username}</span>
                          <button 
                            onClick={() => handleAdminDeleteMessage(msg.id)}
                            style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '14px' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#e50914'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#aaa'}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                        <h4 style={{ margin: '5px 0', fontSize: '18px' }}>📌 Subject: {msg.title}</h4>
                        <p style={{ background: '#111', padding: '10px', borderRadius: '4px', color: '#ddd', fontSize: '15px' }}>{msg.content}</p>
                        
                        {/* 顯示現有回覆，或提供回覆輸入框 */}
                        {msg.reply ? (
                          <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(229,9,20,0.1)', border: '1px dashed #e50914', borderRadius: '4px' }}>
                            <strong style={{ color: '#e50914' }}>✍️ Admin Reply:</strong>
                            <p style={{ margin: '5px 0 0 0', color: '#eee' }}>{msg.reply}</p>
                          </div>
                        ) : (
                          <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                            <input 
                              type="text"
                              placeholder="Type your official reply..."
                              value={adminReplies[msg.id] || ''}
                              onChange={(e) => setAdminReplies({ ...adminReplies, [msg.id]: e.target.value })}
                              style={{ flex: 1, padding: '8px', background: '#333', border: 'none', color: '#fff', borderRadius: '4px' }}
                            />
                            <button 
                              onClick={() => handleAdminReply(msg.id)}
                              style={{ backgroundColor: '#e50914', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 認證彈窗 */}
      {isModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <span onClick={() => setIsModalOpen(false)} className="close-btn">&times;</span>
            <h2>{authMode === 'login' ? 'Account Login' : 'Create Account'}</h2>
            
            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input type="text" placeholder="Enter your username" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" placeholder="Enter your password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} required />
              </div>
              <button type="submit" className="btn-submit">
                {authMode === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            {authMode === 'login' && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <div id="googleSignInButtonReact"></div>
              </div>
            )}

            <p className="toggle-text">
              <span>{authMode === 'login' ? "Don't have an account? " : "Already have an account? "}</span> 
              <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode(authMode === 'login' ? 'register' : 'login'); resetAuthForm(); }}>
                {authMode === 'login' ? 'Register here' : 'Login here'}
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}