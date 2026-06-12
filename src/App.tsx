import React, { useState, useEffect, useRef } from 'react';

// 1. 定義完整的 TypeScript 規範
interface Movie {
  id: number; // 收藏功能需要明確的 ID
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

const API_BASE_URL = "http://localhost:10888/api/v1";
const GOOGLE_CLIENT_ID = "479961485296-bc9qtqof14lj1jv3soqs07qqbqi46hoi.apps.googleusercontent.com"; // 請保持你的真實 ID

export default function App() {
  // ==========================================
  // 2. React 核心狀態管理 (State)
  // ==========================================
  const [movies, setMovies] = useState<Movie[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]); // 🌟 儲存目前用戶收藏的所有電影 ID 清單
  const [loadingMovies, setLoadingMovies] = useState<boolean>(true);
  
  // 分頁狀態：'all' 代表顯示所有電影，'favorites' 代表顯示收藏電影
  const [currentTab, setCurrentTab] = useState<'all' | 'favorites'>('all');

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  // 彈窗控制
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // 表單輸入
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [avatarScale, setAvatarScale] = useState<number>(1.0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // 3. 初始化加載 (useEffect)
  // ==========================================
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
        profile_photo: savedPhoto || null
      });
      // 🌟 如果用戶本来就是登入狀態，初始化時順便抓取他的最愛清單
      fetchFavoriteIds(savedToken);
    }

    initGoogleSignIn();
  }, []);

  useEffect(() => {
    if (isModalOpen && authMode === 'login') {
      renderGoogleButton();
    }
  }, [isModalOpen, authMode]);

  // ==========================================
  // 4. APIs 數據請求邏輯
  // ==========================================
  
  // 獲取所有電影
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

  // 🌟 核心新增：單獨抓取當前用戶收藏的「電影 ID 陣列」，方便在所有電影頁面點亮愛心
  const fetchFavoriteIds = async (userToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/movies/favorites`, {
        headers: { "Authorization": `Bearer ${userToken}` }
      });
      if (response.ok) {
        const favMovies: Movie[] = await response.json();
        // 把收藏電影的 id 提取成陣列，例如 [1, 3]
        setFavoriteIds(favMovies.map(m => m.id));
      }
    } catch (error) {
      console.error("Error fetching favorite ids:", error);
    }
  };

  // 🌟 核心新增：點擊愛心按鈕的 Toggle 處理器
  const handleToggleFavorite = async (movieId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止點擊愛心時觸發卡片其他事件

    if (!token) {
      alert("🔒 Please log in first to add movies to your favorites list!");
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

      // 依據後端回傳的最新狀態，動態更新前端 React 的愛心陣列
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
        localStorage.setItem("profile_photo", data.user.profile_photo || "");

        setToken(data.token);
        setUser({
          username: data.user.username,
          role: data.user.role,
          profile_photo: data.user.profile_photo || null
        });

        // 🌟 登入成功後，立刻同步抓取該用戶的最愛電影清單
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
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem("profile_photo");
    setToken(null);
    setUser(null);
    setFavoriteIds([]); // 登出時清空收藏狀態
    setCurrentTab('all'); // 強制切回首頁
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
      localStorage.setItem("profile_photo", data.user.profile_photo || "");

      setToken(data.token);
      setUser({
        username: data.user.username,
        role: data.user.role,
        profile_photo: data.user.profile_photo || null
      });

      // 🌟 Google 登入大成功，也同步抓取最愛清單
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

  // ==========================================
  // 5. 🧠 資料過濾邏輯 (核心：用狀態計算目前該渲染的電影)
  // ==========================================
  const displayedMovies = currentTab === 'all' 
    ? movies 
    : movies.filter(movie => favoriteIds.includes(movie.id));

  return (
    <div>
      {/* 導覽列 (Navbar) */}
      <header className="navbar">
        <div className="logo" onClick={() => setCurrentTab('all')} style={{ cursor: 'pointer' }}>🎬 CinemaVault</div>
        <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          
          {/* 分頁按鈕 */}
          <button 
            onClick={() => setCurrentTab('all')} 
            className={`tab-btn ${currentTab === 'all' ? 'active-tab' : ''}`}
            style={{ background: 'none', border: 'none', color: currentTab === 'all' ? '#e50914' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
          >
            Home
          </button>

          {/* 🌟 僅有登入的使用者，才能看到並點擊「My Favorites」分頁 */}
          {user && (
            <button 
              onClick={() => setCurrentTab('favorites')} 
              className={`tab-btn ${currentTab === 'favorites' ? 'active-tab' : ''}`}
              style={{ background: 'none', border: 'none', color: currentTab === 'favorites' ? '#e50914' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
            >
              My Favorites ❤️ ({favoriteIds.length})
            </button>
          )}
          
          {/* 個人頭像 */}
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
        <h1>{currentTab === 'all' ? 'Welcome to CinemaVault' : 'Your Personal Collection'}</h1>
        <p>{currentTab === 'all' ? 'Explore current movies, showtimes, and book your tickets seamlessly.' : 'All your curated and loved films kept in one single safe vault.'}</p>
      </section>

      {/* 電影清單區 */}
      <main className="container">
        <h2 className="section-title">
          {currentTab === 'all' ? 'Now Showing' : '❤️ My Favorite Movies'}
        </h2>
        
        <div className="movie-grid">
          {loadingMovies ? (
            <div className="loading">Loading movies from database...</div>
          ) : displayedMovies.length === 0 ? (
            <div className="loading" style={{ color: '#aaa', fontSize: '18px', gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
              {currentTab === 'all' 
                ? '🍿 No movies found in the cinema database.' 
                : '💔 You haven\'t favorited any movies yet. Go back to Home and click the heart!'}
            </div>
          ) : (
            displayedMovies.map((movie) => {
              // 判斷這部電影有沒有在收藏清單內
              const isFav = favoriteIds.includes(movie.id);
              
              return (
                <div key={movie.id} className="movie-card" style={{ position: 'relative' }}>
                  
                  {/* 🌟 核心新增：愛心點擊按鈕 */}
                  <button
                    onClick={(e) => handleToggleFavorite(movie.id, e)}
                    style={{
                      position: 'absolute', top: '15px', right: '15px',
                      background: 'rgba(0, 0, 0, 0.6)', border: 'none',
                      borderRadius: '50%', width: '36px', height: '36px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: '18px', zIndex: 10,
                      transition: 'transform 0.2s', color: isFav ? '#e50914' : '#fff'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1.0)'}
                    title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                  >
                    {isFav ? '❤️' : '🤍'}
                  </button>

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