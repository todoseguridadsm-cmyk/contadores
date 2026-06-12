import React, { useState, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, CheckCircle, AlertCircle, Trash2, Upload, Plus, X, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function TicketsView() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  
  // Estado para Carga Manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    razon_social: '',
    cuit_emisor: '',
    total: '',
    iva: ''
  });

  const [isUploadingToDB, setIsUploadingToDB] = useState(false);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      if(!import.meta.env.VITE_SUPABASE_URL) return;
      const { data, error } = await supabase.from('clientes').select('id, nombre, cuit');
      if (!error) setClientes(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const processFiles = async (filesArray) => {
    if (!selectedCliente) {
      alert("Por favor, selecciona un cliente antes de subir tickets.");
      return;
    }

    const newFiles = filesArray.map(file => ({
      fileObject: file,
      name: file.name,
      status: 'Procesando (IA)...',
      id: Math.random().toString(36).substring(7),
      data: null,
      clienteId: selectedCliente
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);

    for (const nf of newFiles) {
      const formData = new FormData();
      formData.append('ticketImage', nf.fileObject);

      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/parse-ticket`, {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();

        if (response.ok && result.success) {
          // Ya NO subimos directo a Supabase. Se queda en Staging Area (Pendiente de Verificación)
          setUploadedFiles(prev => prev.map(f => {
            if (f.id === nf.id) {
              return { 
                ...f, 
                status: 'Verificar', 
                data: result.data
              };
            }
            return f;
          }));
        } else {
          throw new Error(result.error || 'Fallo OCR');
        }
      } catch (error) {
        setUploadedFiles(prev => prev.map(f => {
          if (f.id === nf.id) {
            return { ...f, status: 'Error', errorMsg: error.message };
          }
          return f;
        }));
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!selectedCliente) {
      alert("Por favor, selecciona un cliente antes de subir tickets.");
      return;
    }
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e) => {
    if (!selectedCliente) {
      alert("Por favor, selecciona un cliente antes de subir tickets.");
      e.target.value = '';
      return;
    }
    const files = Array.from(e.target.files);
    if(files.length > 0) processFiles(files);
  };

  const formatMoney = (amount) => {
    if(!amount) return '$0,00';
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  // UX Actions
  const handleRemoveTicket = (id) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!selectedCliente) {
      alert("Por favor, selecciona un cliente en la pantalla principal antes de cargar manualmente.");
      return;
    }

    const [y, m, d] = manualForm.fecha.split('-');
    const fechaFormat = `${d}/${m}/${y}`;
    const neto = (parseFloat(manualForm.total) - parseFloat(manualForm.iva)).toFixed(2);

    const manualTicket = {
      id: Math.random().toString(36).substring(7),
      name: 'Carga Manual',
      status: 'Verificar',
      clienteId: selectedCliente,
      data: {
        fecha: fechaFormat,
        fechaDb: manualForm.fecha, // Guardamos la YYYY-MM-DD para la BD
        razon_social: manualForm.razon_social,
        cuit_emisor: manualForm.cuit_emisor,
        total: parseFloat(manualForm.total),
        iva: parseFloat(manualForm.iva),
        neto: parseFloat(neto)
      }
    };

    setUploadedFiles(prev => [...prev, manualTicket]);
    setShowManualModal(false);
    setManualForm({ fecha: new Date().toISOString().split('T')[0], razon_social: '', cuit_emisor: '', total: '', iva: '' });
  };

  const handleSubirABaseDeDatos = async () => {
    const ticketsParaSubir = uploadedFiles.filter(f => f.status === 'Verificar' && f.data);
    
    if (ticketsParaSubir.length === 0) return;
    
    setIsUploadingToDB(true);

    try {
      const dbPayload = ticketsParaSubir.map(ticket => {
        // Generar fecha compatible con DB (YYYY-MM-DD)
        let fechaDb;
        if (ticket.data.fechaDb) {
          fechaDb = ticket.data.fechaDb; // Viene de carga manual
        } else {
          // Asumimos que el OCR devolvió DD/MM/YYYY
          const parts = ticket.data.fecha.split('/');
          if (parts.length === 3) {
            fechaDb = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
          } else {
            fechaDb = new Date().toISOString().split('T')[0];
          }
        }

        return {
          cliente_id: ticket.clienteId,
          tipo: 'recibido', // Todos los tickets son gastos/compras
          fecha: fechaDb,
          punto_venta: '00001',
          numero: Math.floor(Math.random() * 100000).toString().padStart(8, '0'),
          tipo_comprobante: '006', // 006 es Factura B
          razon_social_emisor: ticket.data.razon_social,
          cuit_emisor: ticket.data.cuit_emisor.replace(/\D/g, ''),
          neto_gravado: ticket.data.neto,
          no_gravado: 0,
          exento: 0,
          iva: ticket.data.iva,
          total: ticket.data.total,
          neto21: ticket.data.neto, 
          iva21: ticket.data.iva
        };
      });

      const { error } = await supabase.from('comprobantes').insert(dbPayload);
      if (error) throw new Error(error.message);

      // Si fue exitoso, cambiamos el estado visual
      setUploadedFiles(prev => prev.map(f => {
        if (f.status === 'Verificar') return { ...f, status: '¡Subido!' };
        return f;
      }));

    } catch (err) {
      alert("Error al guardar en la base de datos: " + err.message);
    } finally {
      setIsUploadingToDB(false);
    }
  };

  const ticketsVerificar = uploadedFiles.filter(f => f.status === 'Verificar').length;

  return (
    <div className="content-area">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Carga Inteligente de Tickets</h1>
          <p className="page-subtitle">Paso 1: Sube las fotos. Paso 2: Verifica los datos. Paso 3: Sube a la base.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowManualModal(true)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Plus size={18} />
            Carga Manual
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={handleSubirABaseDeDatos} 
            disabled={ticketsVerificar === 0 || isUploadingToDB}
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: ticketsVerificar > 0 ? 'var(--success)' : 'var(--primary)', color: '#fff', border: 'none' }}
          >
            {isUploadingToDB ? <Database size={18} className="spin" /> : <Upload size={18} />}
            {isUploadingToDB ? 'Subiendo...' : `Subir ${ticketsVerificar} Tickets Verificados`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-3" style={{ gridColumn: 'span 3 / span 3' }}>
          
          {/* Selector de Cliente */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>Selecciona a qué cliente asignar los tickets:</label>
            <select 
              className="input-field" 
              value={selectedCliente} 
              onChange={(e) => setSelectedCliente(e.target.value)}
              style={{ cursor: 'pointer', appearance: 'auto' }}
            >
              <option value="">-- Seleccionar Cliente --</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre} (CUIT: {c.cuit})</option>
              ))}
            </select>
          </div>

          {/* Drag & Drop Area */}
          <div 
            className="card"
            style={{ 
              border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border-color)',
              background: isDragging ? 'var(--bg-surface-hover)' : 'var(--bg-main)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '2rem 2rem',
              textAlign: 'center',
              transition: 'all 0.3s ease',
              position: 'relative',
              opacity: selectedCliente ? 1 : 0.5,
              pointerEvents: selectedCliente ? 'auto' : 'none'
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              multiple 
              accept="image/*,application/pdf"
              onChange={handleFileSelect}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: selectedCliente ? 'pointer' : 'default' }}
            />
            <div style={{ background: 'var(--primary-glow)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <UploadCloud size={40} className="primary-text" />
            </div>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>Arrastra y suelta las fotos aquí</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
              {selectedCliente ? "Formatos: JPG, PNG, PDF. La IA los leerá y los pondrá en espera." : "Debes seleccionar un cliente arriba primero."}
            </p>
          </div>

          {/* Staging Area (Tabla de Revisión) */}
          {uploadedFiles.length > 0 && (
            <div className="card" style={{ marginTop: '1.5rem', padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <h3 style={{ margin: 0 }}>Sala de Espera (Verificación)</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Revisa que la IA haya extraído bien los montos antes de subirlos.</p>
              </div>
              
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Archivo</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Emisor (Razón Social)</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                    <th style={{ padding: '0.75rem 1rem' }}>IVA</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Total</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadedFiles.map(file => (
                    <tr key={file.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <ImageIcon size={16} className={file.status === '¡Subido!' ? "success-text" : "primary-text"} />
                          <span style={{ maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                            {file.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: file.status === '¡Subido!' ? 'var(--success)' : file.status === 'Error' ? 'var(--danger)' : 'var(--warning)' }}>
                          {file.status}
                        </span>
                      </td>

                      {file.data ? (
                        <>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 500 }}>{file.data.razon_social}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CUIT: {file.data.cuit_emisor}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>{file.data.fecha}</td>
                          <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{formatMoney(file.data.iva)}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-main)' }}>{formatMoney(file.data.total)}</td>
                        </>
                      ) : (
                        <td colSpan="4" style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                          {file.status === 'Procesando (IA)...' ? 'Extrayendo datos con IA...' : file.errorMsg}
                        </td>
                      )}

                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        {file.status !== '¡Subido!' && (
                          <button 
                            onClick={() => handleRemoveTicket(file.id)}
                            className="icon-btn" 
                            style={{ color: 'var(--danger)', padding: '0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px' }}
                            title="Eliminar ticket"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {file.status === '¡Subido!' && (
                          <CheckCircle size={20} className="success-text" style={{ margin: '0 auto' }} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Carga Manual Modal */}
        {showManualModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card glass" style={{ width: '400px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Carga Manual de Ticket</h3>
                <button className="icon-btn" onClick={() => setShowManualModal(false)}><X size={20} /></button>
              </div>

              <form onSubmit={handleManualSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Fecha</label>
                  <input type="date" className="input-field" style={{ width: '100%' }} value={manualForm.fecha} onChange={e => setManualForm({...manualForm, fecha: e.target.value})} required />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Razón Social (Emisor)</label>
                  <input type="text" className="input-field" style={{ width: '100%' }} placeholder="Ej: YPF S.A." value={manualForm.razon_social} onChange={e => setManualForm({...manualForm, razon_social: e.target.value})} required />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>CUIT Emisor</label>
                  <input type="text" className="input-field" style={{ width: '100%' }} placeholder="Sin guiones" value={manualForm.cuit_emisor} onChange={e => setManualForm({...manualForm, cuit_emisor: e.target.value})} required />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Monto IVA ($)</label>
                    <input type="number" step="0.01" className="input-field" style={{ width: '100%' }} placeholder="0.00" value={manualForm.iva} onChange={e => setManualForm({...manualForm, iva: e.target.value})} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Monto Total ($)</label>
                    <input type="number" step="0.01" className="input-field" style={{ width: '100%' }} placeholder="0.00" value={manualForm.total} onChange={e => setManualForm({...manualForm, total: e.target.value})} required />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowManualModal(false)} style={{ flex: 1 }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Agregar a Lista</button>
                </div>
              </form>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
