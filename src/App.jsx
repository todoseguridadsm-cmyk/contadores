import React, { useState } from 'react';
import { LayoutDashboard, Users, Receipt, Settings, Bell, Search, Plus, Upload, ShieldCheck, LogOut } from 'lucide-react';
import DashboardView from './components/DashboardView';
import ClientesView from './components/ClientesView';
import TicketsView from './components/TicketsView';
import LoginView from './components/LoginView';
import UsuariosView from './components/UsuariosView';
import './App.css';

function App() {
  const [loggedUser, setLoggedUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleLogout = () => {
    setLoggedUser(null);
    setActiveTab('dashboard');
  };

  // Verificamos si el usuario tiene permiso para ver una pestaña
  const hasAccess = (tab) => {
    if (!loggedUser) return false;
    if (loggedUser.role === 'superadmin') return true;
    if (tab === 'usuarios') return false; // Solo superadmin
    return loggedUser.permisos && loggedUser.permisos.includes(tab);
  };

  const renderContent = () => {
    if (activeTab === 'usuarios' && hasAccess('usuarios')) return <UsuariosView />;
    if (activeTab === 'dashboard' && hasAccess('dashboard')) return <DashboardView />;
    if (activeTab === 'clientes' && hasAccess('clientes')) return <ClientesView />;
    if (activeTab === 'tickets' && hasAccess('tickets')) return <TicketsView />;
    
    // Fallback si no tiene acceso a la pestaña actual o no existe
    return (
      <div className="content-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <ShieldCheck size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h2>Acceso Restringido</h2>
          <p>No tienes privilegios para ver esta sección.</p>
        </div>
      </div>
    );
  };

  if (!loggedUser) {
    return <LoginView onLoginSuccess={(user) => {
      setLoggedUser(user);
      // Redirigir a la primera pestaña que tenga permiso
      if (user.role === 'superadmin' || (user.permisos && user.permisos.includes('dashboard'))) {
        setActiveTab('dashboard');
      } else if (user.permisos && user.permisos.includes('clientes')) {
        setActiveTab('clientes');
      } else if (user.permisos && user.permisos.includes('tickets')) {
        setActiveTab('tickets');
      }
    }} />;
  }

  const avatarLetters = loggedUser.username ? loggedUser.username.substring(0, 2).toUpperCase() : 'US';

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar glass">
        <div className="sidebar-header">
          <div className="logo">
            <Receipt className="logo-icon" size={28} />
            <h2>Contadores<span className="text-primary">Pro</span></h2>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {hasAccess('dashboard') && (
            <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <LayoutDashboard size={20} />
              <span>Libro IVA</span>
            </button>
          )}

          {hasAccess('clientes') && (
            <button className={`nav-item ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => setActiveTab('clientes')}>
              <Users size={20} />
              <span>Clientes & Robot</span>
            </button>
          )}

          {hasAccess('tickets') && (
            <button className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
              <Upload size={20} />
              <span>Carga de Tickets</span>
            </button>
          )}

          {/* Menú exclusivo del Súper Administrador */}
          {hasAccess('usuarios') && (
            <>
              <div style={{ marginTop: '2rem', marginBottom: '0.5rem', padding: '0 1.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Administración
              </div>
              <button className={`nav-item ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>
                <ShieldCheck size={20} />
                <span>Usuarios</span>
              </button>
            </>
          )}
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-profile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="avatar" style={{ background: loggedUser.role === 'superadmin' ? 'var(--warning)' : 'var(--primary)' }}>
                <span style={{ color: loggedUser.role === 'superadmin' ? '#000' : '#fff' }}>{avatarLetters}</span>
              </div>
              <div className="user-info">
                <p className="user-name">{loggedUser.username}</p>
                <p className="user-role" style={{ color: loggedUser.role === 'superadmin' ? 'var(--warning)' : 'var(--text-muted)' }}>
                  {loggedUser.role === 'superadmin' ? 'Súper Admin' : 'Empleado'}
                </p>
              </div>
            </div>
            <button className="icon-btn" onClick={handleLogout} title="Cerrar Sesión">
              <LogOut size={18} className="danger-text" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="header glass">
          <div className="search-bar">
            <Search size={18} className="search-icon" />
            <input type="text" placeholder="Buscar cliente, cuit o comprobante..." className="input-field search-input" />
          </div>
          <div className="header-actions">
            <button className="icon-btn">
              <Bell size={20} />
              <span className="badge">3</span>
            </button>
            {hasAccess('clientes') && (
              <button className="btn btn-primary" onClick={() => setActiveTab('clientes')}>
                <Plus size={18} />
                <span>Nuevo Cliente</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Views */}
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
