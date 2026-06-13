import React, { useState, useEffect, useRef } from 'react';

interface Movie {
  id: number;
  title: string;
  genre: string;
  year: number;
  director: string;
  poster?: string | null; // 🌟 OMDb 真實海報網址
  actors?: string;        // 🌟 OMDb 真實演員名單
  plot?: string;          // 🌟 OMDb 真實劇情簡介
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

interface SocialPost {
  platform: string;
  message: string;
  timestamp: string;
}

const API_BASE_URL = "http://localhost:10888/api/v1";
const GOOGLE_CLIENT_ID = "479961485296-bc9qtqof14lj1jv3soqs07qqbqi46hoi.apps.googleusercontent.com"; 

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]); 
  const [loadingMovies, setLoadingMovies] = useState<boolean>(true);
  
  const [currentTab, setCurrentTab] = useState<'all' | 'favorites' | 'messages' | 'social'>('all');

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

  // 📱 虛擬社群動態牆狀態管理
  const [socialFeed, setSocialFeed] = useState<SocialPost[]>([]);

  // 🎬 串接 OMDb 後：點擊電影卡片彈出詳情視窗的狀態管理
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);

  // 🔍 核心全新加入：搜尋與篩選狀態管理
  const [searchTitle, setSearchTitle] = useState<string>('');
  const [filterGenre, setFilterGenre] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<string>('latest');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 當任何一個篩選或排序條件改變時，即時自動觸發 API 動態查詢（極佳的 UX 互動體驗！）
  useEffect(() => {
    fetchMovies();
  }, [searchTitle, filterGenre, filterYear, sortOrder]);

  useEffect(() => {
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

  useEffect(() => {
    if (currentTab === 'messages' && user?.role === 'admin' && token) {
      fetchAdminMessages();
    }
  }, [currentTab, user, token]);

  useEffect(() => {
    if (currentTab === 'social') {
      fetchSocialFeed();
    }
  }, [currentTab]);

  // 🌟 升級版 API 串接：將篩選參數拼接到網址中，實現動態複合查詢
  const fetchMovies = async () => {
    try {
      setLoadingMovies(true);
      
      // 建立動態 URL 參數
      const params = new URLSearchParams();
      if (searchTitle.trim()) params.append('title', searchTitle.trim());
      if (filterGenre) params.append('genre', filterGenre);
      if (filterYear.trim()) params.append('year', filterYear.trim());
      if (sortOrder) params.append('sortBy', sortOrder);

      const response = await fetch(`${API_BASE_URL}/movies?${params.toString()}`);
      const data = await response.json();
      setMovies(data);
    } catch (error) {
      console.error("Error loading filtered movies:", error);
    } finally {
      setLoadingMovies(false);
    }
  };

  // 清空所有篩選條件的快速重置按鈕邏輯
  const handleResetFilters = () => {
    setSearchTitle('');
    setFilterGenre('');
    setFilterYear('');
    setSortOrder('latest');
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

  const fetchSocialFeed = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/movies/social-feed`);
      if (res.ok) {
        const data = await res.json();
        setSocialFeed(data);
      }
    } catch (err) {
      console.error("Failed to fetch social feed", err);
    }
  };

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
      fetchAdminMessages();
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    }
  };

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

  // 用戶在我的最愛分頁時，前端基於已過濾的清單再次提供最愛過濾
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

          <button 
            onClick={() => setCurrentTab('social')} 
            style={{ background: 'none', border: 'none', color: currentTab === 'social' ? '#ffb400' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
          >
            📱 Social Feed
          </button>

          {user && user.role !== 'admin' && (
            <button 
              onClick={() => setCurrentTab('favorites')} 
              style={{ background: 'none', border: 'none', color: currentTab === 'favorites' ? '#e50914' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
            >
              My Favorites ❤️ ({favoriteIds.length})
            </button>
          )}

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
          {currentTab === 'social' && 'Automated Social Broadcast'}
        </h1>
        <p>
          {currentTab === 'all' && 'Explore current movies, showtimes, and book your tickets seamlessly.'}
          {currentTab === 'favorites' && 'All your curated and loved films kept in one single safe vault.'}
          {currentTab === 'messages' && (user?.role === 'admin' ? 'Review questions and reply to CinemaVault members.' : 'Have any feedback or questions? Drop a mail directly to our Admin group.')}
          {currentTab === 'social' && 'Real-time simulated webhook feed broadcasting newly released movies to Facebook and Twitter profiles.'}
        </p>
      </section>

      {/* 主內容渲染區區塊 */}
      <main className="container">
        {currentTab !== 'messages' && currentTab !== 'social' ? (
          <>
            {/* 🌟 核心全新加入：大眾複合篩選控制列 (UX Filter Bar Bar Control) */}
            <div style={{
              background: '#151515', padding: '20px', borderRadius: '8px', 
              marginBottom: '30px', border: '1px solid #252525',
              display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center'
            }}>
              {/* A. 關鍵字搜尋輸入框 */}
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>SEARCH BY TITLE</label>
                <input 
                  type="text"
                  value={searchTitle}
                  onChange={(e) => setSearchTitle(e.target.value)}
                  placeholder="🍿 Type to search film..."
                  style={{ width: '100%', padding: '10px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}
                />
              </div>

              {/* B. 電影類型下拉選單 */}
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>GENRE FILTER</label>
                <select
                  value={filterGenre}
                  onChange={(e) => setFilterGenre(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <option value="">All Genres</option>
                  <option value="Sci-Fi">Sci-Fi (科幻)</option>
                  <option value="Action">Action (動作)</option>
                  <option value="Adventure">Adventure (冒險)</option>
                  <option value="Drama">Drama (劇情)</option>
                  <option value="Thriller">Thriller (驚悚)</option>
                </select>
              </div>

              {/* C. 年份精準輸入框 */}
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>RELEASE YEAR</label>
                <input 
                  type="number"
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  placeholder="Ex: 2014"
                  style={{ width: '100%', padding: '10px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '4px' }}
                />
              </div>

              {/* D. 智慧排序下拉選單 */}
              <div style={{ flex: '1 1 150px' }}>
                <label style={{ display: 'block', color: '#aaa', fontSize: '12px', marginBottom: '5px', fontWeight: 'bold' }}>SORT BY</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: '#222', color: '#fff', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <option value="latest">Latest Added (最新上架)</option>
                  <option value="year_desc">Year: New to Old (年份：新到舊)</option>
                  <option value="year_asc">Year: Old to New (年份：舊到新)</option>
                </select>
              </div>

              {/* E. 快速一鍵重置按鈕 */}
              <div style={{ alignSelf: 'flex-end' }}>
                <button
                  onClick={handleResetFilters}
                  style={{
                    padding: '10px 18px', backgroundColor: '#333', color: '#fff',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#444'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#333'}
                >
                  🔄 Reset
                </button>
              </div>
            </div>

            <h2 className="section-title">
              {currentTab === 'all' ? 'Now Showing' : '❤️ My Favorite Movies'}
            </h2>
            <div className="movie-grid">
              {loadingMovies ? (
                <div className="loading" style={{ gridColumn: '1/-1', textAlign: 'center', color: '#e50914', fontSize: '18px' }}>Searching CinemaVault database...</div>
              ) : displayedMovies.length === 0 ? (
                <div className="loading" style={{ color: '#aaa', fontSize: '18px', gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
                  {currentTab === 'all' ? '🍿 No movies match your filter criteria.' : '💔 No favorite movies match your filter criteria.'}
                </div>
              ) : (
                displayedMovies.map((movie) => {
                  const isFav = favoriteIds.includes(movie.id);
                  return (
                    /* 🌟 點擊卡片將會開啟 OMDb 詳細資訊彈窗 */
                    <div key={movie.id} className="movie-card" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setSelectedMovie(movie)}>
                      
                      {/* OMDb 海報呈現區塊 */}
                      <div className="movie-poster-wrapper" style={{ width: '100%', height: '320px', background: '#222', overflow: 'hidden' }}>
                        {movie.poster ? (
                          <img src={movie.poster} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: '40px' }}>🎬</div>
                        )}
                      </div>

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
                      <div className="movie-info" style={{ padding: '15px' }}>
                        <span className="movie-tag">{movie.genre}</span>
                        <h3 className="movie-title" style={{ margin: '8px 0', fontSize: '18px', color: '#fff' }}>{movie.title}</h3>
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
        ) : currentTab === 'social' ? (
          <div style={{ maxWidth: '650px', margin: '0 auto', background: '#151515', padding: '25px', borderRadius: '8px', border: '1px solid #292929' }}>
            <h2 style={{ borderBottom: '2px solid #ffb400', paddingBottom: '10px', color: '#fff' }}>📱 Live Social Feed</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {socialFeed.length === 0 ? (
                <p style={{ color: '#aaa', textAlign: 'center', padding: '30px 0' }}>📭 No social media logs generated yet. Try adding a new film entry as Admin to trigger the automated webhooks!</p>
              ) : (
                socialFeed.map((post, index) => (
                  <div key={index} style={{ background: '#222', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #ffb400' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginBottom: '5px' }}>
                      <span>🖥️ Sync Hub: {post.platform}</span>
                      <span>{post.timestamp}</span>
                    </div>
                    <p style={{ color: '#fff', margin: '5px 0 0 0', fontSize: '14px', lineHeight: '1.5' }}>{post.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '800px', margin: '0 auto', color: '#fff', padding: '20px', background: '#181818', borderRadius: '8px' }}>
            {user?.role !== 'admin' ? (
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
              <div>
                <h3 style={{ borderBottom: '2px solid #e50914', paddingBottom: '10px' }}>📩 Customer Tickets Inbox ({messages.length})</h3>
                {messages.length === 0 ? (
                  <p style={{ padding: '20px 0', color: '#aaa' }}>📭 Inbox is clean. No customer requests yet.</p>
                ) : (
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {messages.map((msg) => (
                      <div key={msg.id} style={{ background: '#222', padding: '15px', borderRadius: '6px', borderLeft: '4px solid #e50914' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
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

      {/* 🌟 華麗彈窗：點擊電影卡片後顯示 OMDb 真實詳情資訊 */}
      {selectedMovie && (
        <div className="modal" style={{ display: 'flex', zIndex: 999 }}>
          <div className="modal-content" style={{ maxWidth: '600px', padding: '0', overflow: 'hidden', background: '#1c1c1c', border: '1px solid #333' }}>
            <span onClick={() => setSelectedMovie(null)} className="close-btn" style={{ position: 'absolute', top: '15px', right: '20px', zIndex: 100, fontSize: '30px', color: '#fff', cursor: 'pointer' }}>&times;</span>
            
            <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', background: '#000' }}>
                {selectedMovie.poster ? (
                  <img src={selectedMovie.poster} alt={selectedMovie.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#444', fontSize: '50px' }}>🎬</div>
                )}
              </div>
              <div style={{ flex: '1 2 320px', padding: '25px', color: '#fff' }}>
                <span style={{ background: '#e50914', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{selectedMovie.genre}</span>
                <h2 style={{ margin: '10px 0 5px 0', fontSize: '24px' }}>{selectedMovie.title}</h2>
                <p style={{ margin: '0 0 15px 0', color: '#888', fontSize: '14px' }}>Release Year: {selectedMovie.year}</p>
                
                <div style={{ borderTop: '1px solid #333', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
                  <p><strong>🎬 Director:</strong> {selectedMovie.director}</p>
                  <p><strong>🎭 Starring:</strong> {selectedMovie.actors || "N/A"}</p>
                  <p style={{ marginTop: '10px', lineHeight: '1.6', color: '#ccc', background: '#111', padding: '12px', borderRadius: '6px' }}>
                    <strong>📝 Plot Summary:</strong><br />
                    {selectedMovie.plot || "No summary found."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                <input 
                  type="password" 
                  placeholder="Enter your password" 
                  value={passwordInput} 
                  onChange={(e) => setPasswordInput(e.target.value)} 
                  required 
                />
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