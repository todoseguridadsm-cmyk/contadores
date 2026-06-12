import React, { useState } from 'react';
import { LayoutDashboard, Users, Receipt, Settings, Bell, Search, Plus, Upload } from 'lucide-react';
import DashboardView from './components/DashboardView';
import ClientesView from './components/ClientesView';
import TicketsView from './components/TicketsView';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <DashboardView />;
      case 'clientes': return <ClientesView />;
      case 'tickets': return <TicketsView />;
      case 'config': return <div className="content-area"><h1 className="page-title">Configuración</h1><p className="page-subtitle">Ajustes del sistema (En construcción)</p></div>;
      default: return <DashboardView />;
    }
  };

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
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </button>
          <button className={`nav-item ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => setActiveTab('clientes')}>
            <Users size={20} />
            <span>Clientes</span>
          </button>
          <button className={`nav-item ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>
            <Upload size={20} />
            <span>Carga de Tickets</span>
          </button>
          <button className={`nav-item ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            <Settings size={20} />
            <span>Configuración</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="avatar">CB</div>
            <div className="user-info">
              <p className="user-name">Carlos B.</p>
              <p className="user-role">Contador Admin</p>
            </div>
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
            <button className="btn btn-primary" onClick={() => setActiveTab('clientes')}>
              <Plus size={18} />
              <span>Nuevo Cliente</span>
            </button>
          </div>
        </header>

        {/* Dynamic Views */}
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
