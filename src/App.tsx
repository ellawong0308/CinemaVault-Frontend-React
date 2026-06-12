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

const API_BASE_URL = "http://localhost:10888/api/v1";
// 🌟 請記得換成你真實的 Google Client ID
const GOOGLE_CLIENT_ID = "479961485296-bc9qtqof14lj1jv3soqs07qqbqi46hoi.apps.googleusercontent.com"; 

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]); 
  const [loadingMovies, setLoadingMovies] = useState<boolean>(true);
  const [currentTab, setCurrentTab] = useState<'all' | 'favorites'>('all');

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [avatarScale, setAvatarScale] = useState<number>(1.0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // 3. 初始化加載 (useEffect) - 修正生命週期載入順序
  // ==========================================
  useEffect(() => {
    fetchMovies();

    const savedToken = localStorage.getItem("token");
    const savedUsername = localStorage.getItem("username");
    const savedRole = localStorage.getItem("role");
    const savedPhoto = localStorage.getItem("profile_photo");

    if (savedToken && savedUsername && savedRole) {
      // 🌟 核心修正：確保狀態與本地快取強行同步
      setToken(savedToken);
      setUser({
        username: savedUsername,
        role: savedRole,
        profile_photo: savedPhoto || null // 確保重新整理網頁時頭像不會漏掉
      });
      
      // 傳入確切的暫存 token，防止異步狀態未更新導致 API 抓取失敗
      fetchFavoriteIds(savedToken);
    }

    initGoogleSignIn();
  }, []);

  // 當彈窗打開且切換到登入模式時，確保 Google 按鈕能重新渲染
  useEffect(() => {
    if (isModalOpen && authMode === 'login') {
      renderGoogleButton();
    }
  }, [isModalOpen, authMode]);

  // ==========================================
  // 4. APIs 數據請求邏輯
  // ==========================================
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

  const handleToggleFavorite = async (movieId: number, e: React.MouseEvent) => {
    e.stopPropagation();

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

      if (data.isFavorite) {
        setFavoriteIds(prev => [...prev, movieId]);
      } else {
        setFavoriteIds(prev => prev.filter(id => id !== movieId));
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  // 🌟 核心修正：原生帳密登入大會師，確保 profile_photo 注入 React 狀態
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

        // 將後端回傳的最新頭像路徑牢牢記在 LocalStorage 中
        const photoPath = data.user.profile_photo || "";
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.user.username);
        localStorage.setItem("role", data.user.role);
        localStorage.setItem("profile_photo", photoPath);

        setToken(data.token);
        setUser({
          username: data.user.username,
          role: data.user.role,
          profile_photo: photoPath || null // 🌟 關鍵修正：當場點亮 React 頭像狀態
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
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem("profile_photo");
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

      // 成功上傳後，除了存入 localStorage，更要立即同步更新 React 狀態
      localStorage.setItem("profile_photo", data.photoUrl);
      setUser(prev => prev ? { ...prev, profile_photo: data.photoUrl } : null);
      alert("📸 Profile photo updated successfully!");
    } catch (error: any) {
      alert(`❌ Upload Failed: ${error.message}`);
    } {
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

  // 🌟 核心修正：Google 第三方登入大會師，確保 profile_photo 注入 React 狀態
  const handleGoogleCredentialResponse = async (response: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/google-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: response.credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google authentication failed");

      const photoPath = data.user.profile_photo || "";
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.user.username);
      localStorage.setItem("role", data.user.role);
      localStorage.setItem("profile_photo", photoPath);

      setToken(data.token);
      setUser({
        username: data.user.username,
        role: data.user.role,
        profile_photo: photoPath || null // 🌟 關鍵修正：當場點亮 Google 使用者的頭像狀態
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

          {user && (
            <button 
              onClick={() => setCurrentTab('favorites')} 
              style={{ background: 'none', border: 'none', color: currentTab === 'favorites' ? '#e50914' : '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}
            >
              My Favorites ❤️ ({favoriteIds.length})
            </button>
          )}
          
          {/* 個人頭像顯示區 */}
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
              const isFav = favoriteIds.includes(movie.id);
              
              return (
                <div key={movie.id} className="movie-card" style={{ position: 'relative' }}>
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