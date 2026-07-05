import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/navbar/navbar';
import Footer from './components/footer/footer';
import Auth from './pages/auth/Auth';
import Home from './pages/Home/Home';
import Onboarding from './pages/onboarding/onboarding'; 
import Dashboard from './pages/dashboard/Dashboard';
import Sell from './pages/sell/Sell';
import Marketplace from './pages/marketplace/Marketplace';
import ProductDetail from "./pages/product/ProductDetail";
import PublicProfile from "./pages/publicProfile/PublicProfile";
import Messages from "./pages/messages/Messages";

function App() {
  const location = useLocation(); // Get current route
  const isDemoUser = localStorage.getItem("yahora_demo_user") === "true";

  return (

    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* 🚧 GLOBAL DEMO BANNER 🚧 */}
      {isDemoUser && (
        <div style={{
          background: 'linear-gradient(90deg, #FFB347, #FF7B00)',
          color: 'white',
          textAlign: 'center',
          padding: '8px 16px',
          fontWeight: '600',
          fontSize: '0.85rem',
          letterSpacing: '0.02em',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🚧</span>
          You are viewing the Yahora Interactive Demo Sandbox. This is not real student data.
        </div>
      )}
      
      <Navbar />
      
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path= "/" element={<Home/>} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/feed" element={<div className="container mt-4"><h3>Community Feed</h3></div>} />
          <Route path="/hot" element={<div className="container mt-4"><h3>Hot Items on Campus</h3></div>} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/user/:id" element={<PublicProfile />} />
          <Route path="/messages" element={<Messages />} />
        </Routes>
      </main>

      {/* Conditionally hide the footer ONLY on the dashboard */}
      {location.pathname !== '/dashboard' && <Footer />}
    </div>
  );
}

export default App;