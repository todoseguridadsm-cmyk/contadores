import React, { useState, useEffect } from 'react';
import { UserPlus, Edit2, Trash2, Shield, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function UsuariosView() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    id: null,
    username: '',
    password: '',
    role: 'empleado',
    permisos: {
      dashboard: true,
      clientes: true,
      tickets: false
    }
  });

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('usuarios').select('*').order('created_at', { ascending: false });
      if (error) {
        if (error.message.includes('relation "usuarios" does not exist')) {
          console.warn("La tabla usuarios no existe aún en Supabase.");
        } else {
          throw error;
        }
      }
      setUsuarios(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      // Editar
      const perms = Array.isArray(user.permisos) ? user.permisos : [];
      setFormData({
        id: user.id,
        username: user.username,
        password: user.password,
        role: user.role,
        permisos: {
          dashboard: perms.includes('dashboard'),
          clientes: perms.includes('clientes'),
          tickets: perms.includes('tickets')
        }
      });
    } else {
      // Nuevo
      setFormData({
        id: null,
        username: '',
        password: '',
        role: 'empleado',
        permisos: {
          dashboard: true,
          clientes: true,
          tickets: false
        }
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Transformar el objeto de permisos en un array para la base de datos
    const arrayPermisos = Object.keys(formData.permisos).filter(key => formData.permisos[key]);

    const userToSave = {
      username: formData.username,
      password: formData.password,
      role: formData.role,
      permisos: arrayPermisos
    };

    try {
      if (formData.id) {
        // Update
        const { error } = await supabase.from('usuarios').update(userToSave).eq('id', formData.id);
        if (error) throw error;
        alert("Empleado actualizado con éxito");
      } else {
        // Insert
        const { error } = await supabase.from('usuarios').insert([userToSave]);
        if (error) throw error;
        alert("Empleado creado con éxito");
      }
      setShowModal(false);
      fetchUsuarios();
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
  };

  const handleDelete = async (id, username) => {
    if (window.confirm(`¿Estás seguro de eliminar permanentemente al empleado ${username}?`)) {
      try {
        const { error } = await supabase.from('usuarios').delete().eq('id', id);
        if (error) throw error;
        fetchUsuarios();
      } catch (err) {
        alert("Error al eliminar: " + err.message);
      }
    }
  };

  const handlePermisoToggle = (permiso) => {
    setFormData(prev => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [permiso]: !prev.permisos[permiso]
      }
    }));
  };

  return (
    <div className="content-area">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Gestión de Usuarios</h1>
          <p className="page-subtitle">Crea empleados y define a qué secciones tienen acceso.</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <UserPlus size={18} />
          Nuevo Empleado
        </button>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        {loading ? (
          <p>Cargando empleados...</p>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '1rem' }}>Usuario</th>
                <th style={{ padding: '1rem' }}>Rol</th>
                <th style={{ padding: '1rem' }}>Accesos Permitidos</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {/* Mostramos al Súper Administrador fijo solo como referencia */}
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 215, 0, 0.05)' }}>
                <td style={{ padding: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={16} className="text-warning" /> Contadorpro
                </td>
                <td style={{ padding: '1rem' }}>
                  <span className="badge" style={{ background: 'var(--warning)', color: '#000' }}>Súper Admin</span>
                </td>
                <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>Acceso Total Mestro</td>
                <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-muted)' }}>
                  Inamovible
                </td>
              </tr>

              {usuarios.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem', fontWeight: 500 }}>{u.username}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {(u.permisos || []).map(p => (
                        <span key={p} style={{ background: 'var(--bg-main)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid var(--border-color)' }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button className="icon-btn" style={{ color: 'var(--primary)', marginRight: '0.5rem' }} onClick={() => handleOpenModal(u)}>
                      <Edit2 size={18} />
                    </button>
                    <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(u.id, u.username)}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay empleados registrados. Crea el primero.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card glass" style={{ width: '400px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{formData.id ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
              <button className="icon-btn" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nombre de Usuario</label>
                <input 
                  type="text" 
                  className="input-field" 
                  style={{ width: '100%' }}
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Contraseña</label>
                <input 
                  type="password" 
                  className="input-field" 
                  style={{ width: '100%' }}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 600 }}>Permisos de Acceso</label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.permisos.dashboard} onChange={() => handlePermisoToggle('dashboard')} />
                  <span>Dashboard (Libro IVA)</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.permisos.clientes} onChange={() => handlePermisoToggle('clientes')} />
                  <span>Gestión de Clientes y Robot</span>
                </label>
                
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={formData.permisos.tickets} onChange={() => handlePermisoToggle('tickets')} />
                  <span>Carga de Tickets (OCR)</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                  <Save size={18}/> Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
