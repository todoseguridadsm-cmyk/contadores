import React, { useState, useEffect, useCallback } from 'react';
import { LayoutDashboard, Users, Receipt, Settings, Search, Plus, Upload, ShieldCheck, LogOut, Database, Bell } from 'lucide-react';
import DashboardView from './components/DashboardView';
import ClientesView from './components/ClientesView';
import TicketsView from './components/TicketsView';
import LoginView from './components/LoginView';
import UsuariosView from './components/UsuariosView';
import BackupView from './components/BackupView';
import BandejaView from './components/BandejaView';
import { supabase } from './lib/supabase';
import './App.css';

function App() {
  const [loggedUser, setLoggedUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = useCallback(() => {
    setLoggedUser(null);
    setActiveTab('dashboard');
  }, []);

  // Auto-cierre de sesión a los 7 minutos de inactividad
  useEffect(() => {
    if (!loggedUser) return;

    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout();
        alert('Tu sesión ha expirado por inactividad (7 minutos). Vuelve a ingresar para continuar.');
      }, 7 * 60 * 1000); // 7 minutos en milisegundos
    };

    // Escuchar eventos de actividad del usuario
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);

    resetTimer(); // Iniciar el contador apenas se loguea

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [loggedUser, handleLogout]);

  // Obtener conteo de mensajes no leídos de AFIP
  useEffect(() => {
    if (!loggedUser) return;
    const fetchUnread = async () => {
      try {
        if (!import.meta.env.VITE_SUPABASE_URL) return;
        const { data, error } = await supabase.from('clientes').select('ventas_json');
        if (error) return;
        let count = 0;
        if(data) {
          data.forEach(c => {
            if (c.ventas_json && c.ventas_json.notificaciones) {
              count += c.ventas_json.notificaciones.filter(n => !n.leido).length;
            }
          });
        }
        setUnreadCount(count);
      } catch (e) {
        console.error(e);
      }
    };
    fetchUnread();
  }, [loggedUser, activeTab]); // Se refresca cuando el usuario cambia de pestaña

  // Verificamos si el usuario tiene permiso para ver una pestaña
  const hasAccess = (tab) => {
    if (!loggedUser) return false;
    if (loggedUser.role === 'superadmin') return true;
    if (tab === 'usuarios' || tab === 'backup') return false; // Solo superadmin
    if (tab === 'bandeja') return true; // Todos pueden ver la bandeja
    return loggedUser.permisos && loggedUser.permisos.includes(tab);
  };

  const renderContent = () => {
    if (activeTab === 'usuarios' && hasAccess('usuarios')) return <UsuariosView />;
    if (activeTab === 'dashboard' && hasAccess('dashboard')) return <DashboardView />;
    if (activeTab === 'clientes' && hasAccess('clientes')) return <ClientesView />;
    if (activeTab === 'tickets' && hasAccess('tickets')) return <TicketsView />;
    if (activeTab === 'backup' && hasAccess('backup')) return <BackupView />;
    if (activeTab === 'bandeja' && hasAccess('bandeja')) return <BandejaView />;
    
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

          {hasAccess('bandeja') && (
            <button className={`nav-item ${activeTab === 'bandeja' ? 'active' : ''}`} onClick={() => setActiveTab('bandeja')} style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Bell size={20} />
                <span>Bandeja AFIP</span>
              </div>
              {unreadCount > 0 && (
                <span style={{ background: 'var(--danger)', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {unreadCount}
                </span>
              )}
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
                Administración & Seguridad
              </div>
              <button className={`nav-item ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>
                <ShieldCheck size={20} />
                <span>Usuarios</span>
              </button>
              <button className={`nav-item ${activeTab === 'backup' ? 'active' : ''}`} onClick={() => setActiveTab('backup')}>
                <Database size={20} />
                <span>Backups (Respaldo)</span>
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
