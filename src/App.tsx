import React, { useState, useEffect, useRef } from 'react';

// 1. 定義明確的 TypeScript 資料型態 (TypeScript Interface 規範)
interface Movie {
  id?: number;
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
// 🌟 安全性設定：請記得將這裡改成你真實的 Google Client ID
const GOOGLE_CLIENT_ID = "479961485296-bc9qtqof14lj1jv3soqs07qqbqi46hoi.apps.googleusercontent.com";

export default function App() {
  // 2. React 核心狀態管理 (State) - 取代原本原生 JS 的變數與隱藏顯示
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loadingMovies, setLoadingMovies] = useState<boolean>(true);
  
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  // 控制認證彈窗與模式
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // 表單輸入綁定
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  
  // 圓形頭像懸停特效狀態
  const [avatarScale, setAvatarScale] = useState<number>(1.0);

  // 利用 useRef 存取隱藏的 File Input 元素
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // 3. 副作用控制 (useEffect) - 初始化加載
  // ==========================================
  useEffect(() => {
    // 初始載入電影
    fetchMovies();

    // 從瀏覽器緩存恢復會員登入狀態
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
    }

    // 初始化 Google 第三方登入官方元件
    initGoogleSignIn();
  }, []);

  // 當彈窗打開且切換到登入模式時，確保 Google 按鈕能重新渲染
  useEffect(() => {
    if (isModalOpen && authMode === 'login') {
      renderGoogleButton();
    }
  }, [isModalOpen, authMode]);

  // ==========================================
  // 4. APIs 異步串接邏輯 (Fetch API)
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

        // 持久化儲存
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
    alert("🔒 Logged out successfully!");
  };

  // ==========================================
  // 5. 📷 處理大頭貼點擊與異步 FormData 上傳
  // ==========================================
  const handleAvatarClick = () => {
    fileInputRef.current?.click(); // 觸發隱藏的 file input
  };

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

      // 成功上傳，同步刷新 React 狀態與 LocalStorage
      localStorage.setItem("profile_photo", data.photoUrl);
      setUser(prev => prev ? { ...prev, profile_photo: data.photoUrl } : null);
      
      alert("📸 Profile photo updated successfully!");
    } catch (error: any) {
      alert(`❌ Upload Failed: ${error.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""; // 清空 input 檔案
    }
  };

  // ==========================================
  // 6. 🌐 Google 第三方認證整合
  // ==========================================
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
  // 7. TSX 視覺元件渲染 (JSX/TSX 結構)
  // ==========================================
  return (
    <div>
      {/* 導覽列 (Navbar) */}
      <header className="navbar">
        <div className="logo">🎬 CinemaVault</div>
        <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <a href="#" className="active">Home</a>
          
          {/* 🌟 核心：頭像顯示區 (React 狀態條件渲染) */}
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
                  width: '35px', 
                  height: '35px', 
                  borderRadius: '50%', 
                  objectFit: 'cover', 
                  border: '2px solid #e50914', 
                  backgroundColor: '#333',
                  transform: `scale(${avatarScale})`,
                  transition: 'transform 0.2s'
                }}
              />
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>
          )}

          <span className="user-info">
            {user ? `Hello, ${user.username} (${user.role.toUpperCase()})` : ''}
          </span>
          
          <button 
            onClick={() => user ? handleLogout() : { ...setIsModalOpen(true), ...setAuthMode('login') }} 
            className="btn-login"
            style={{ backgroundColor: user ? '#333' : '#e50914', border: 'none', color: 'white', cursor: 'pointer', padding: '8px 16px', borderRadius: '4px' }}
          >
            {user ? 'Logout' : 'Login'}
          </button>
        </nav>
      </header>

      {/* Hero 區塊 */}
      <section className="hero">
        <h1>Welcome to CinemaVault</h1>
        <p>Explore current movies, showtimes, and book your tickets seamlessly.</p>
      </section>

      {/* 主體電影網格 */}
      <main className="container">
        <h2 className="section-title">Now Showing</h2>
        <div className="movie-grid">
          {loadingMovies ? (
            <div className="loading">Loading movies from database...</div>
          ) : movies.length === 0 ? (
            <div className="loading">🍿 No movies found in the cinema database.</div>
          ) : (
            movies.map((movie, index) => (
              <div key={movie.id || index} className="movie-card">
                <div className="movie-info">
                  <span className="movie-tag">{movie.genre}</span>
                  <h3 className="movie-title">{movie.title}</h3>
                  <div className="movie-details">
                    <p><strong>Director:</strong> {movie.director}</p>
                    <p><strong>Release Year:</strong> {movie.year}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* 🌟 認證彈窗 (React 彈出視窗組件) */}
      {isModalOpen && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <span onClick={() => setIsModalOpen(false)} className="close-btn">&times;</span>
            <h2>{authMode === 'login' ? 'Account Login' : 'Create Account'}</h2>
            
            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label>Username</label>
                <input 
                  type="text" 
                  placeholder="Enter your username" 
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  required 
                />
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
                {/* 🌟 Google 渲染錨點 */}
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