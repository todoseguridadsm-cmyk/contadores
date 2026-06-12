import React, { useState, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { exportarTicketsTxtAFIP } from '../utils/exportacion';

export default function TicketsView() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');

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
        const response = await fetch('http://localhost:3001/api/parse-ticket', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();

        if (response.ok && result.success) {
          
          // Guardar automáticamente en Supabase
          const fechaDb = new Date().toISOString().split('T')[0];
          
          const { error: dbError } = await supabase.from('comprobantes').insert([{
            cliente_id: nf.clienteId,
            tipo: 'recibido', // Todos los tickets son gastos/compras
            fecha: fechaDb,
            punto_venta: '00001', // Valor por defecto para tickets mock
            numero: Math.floor(Math.random() * 100000).toString().padStart(8, '0'),
            tipo_comprobante: '006', // 006 es Factura B (Consumidor Final)
            razon_social_emisor: result.data.razon_social,
            cuit_emisor: result.data.cuit_emisor.replace(/\D/g, ''),
            neto_gravado: result.data.neto,
            no_gravado: 0,
            exento: 0,
            iva: result.data.iva,
            total: result.data.total,
            neto21: result.data.neto, // Asumimos 21% por defecto en tickets YPF
            iva21: result.data.iva
          }]);

          if (dbError) throw new Error("Error guardando en BD: " + dbError.message);

          setUploadedFiles(prev => prev.map(f => {
            if (f.id === nf.id) {
              return { 
                ...f, 
                status: 'Completado', 
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
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
  };

  return (
    <div className="content-area">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Carga Inteligente de Tickets</h1>
          <p className="page-subtitle">Asigna tickets de papel a tus clientes. La Inteligencia Artificial extraerá el IVA automáticamente y los sumará al Libro IVA.</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-3" style={{ gridColumn: 'span 3 / span 3' }}>
          
          {/* Selector de Cliente */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 600 }}>1. Selecciona a qué cliente asignar los tickets:</label>
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
              padding: '4rem 2rem',
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
              <UploadCloud size={48} className="primary-text" />
            </div>
            <h3 style={{ marginBottom: '0.5rem' }}>Arrastra y suelta las fotos aquí</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              {selectedCliente ? "Formatos soportados: JPG, PNG, PDF. (Máx 10MB)" : "Debes seleccionar un cliente arriba primero."}
            </p>
            <button className="btn btn-primary" style={{ pointerEvents: 'none' }}>Examinar archivos</button>
          </div>

          {/* Uploaded List */}
          {uploadedFiles.length > 0 && (
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Tickets Procesados</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {uploadedFiles.map(file => (
                  <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <ImageIcon size={24} className={file.status === 'Completado' ? "success-text" : "primary-text"} />
                      <div>
                        <p style={{ fontWeight: 500, margin: 0, color: 'var(--text-main)' }}>{file.name}</p>
                        <p style={{ 
                          fontSize: '0.8rem', 
                          color: file.status === 'Completado' ? 'var(--success)' : file.status === 'Error' ? 'var(--danger)' : 'var(--warning)', 
                          margin: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' 
                        }}>
                          {file.status === 'Completado' && <CheckCircle size={12} />}
                          {file.status === 'Error' && <AlertCircle size={12} />}
                          {file.status}
                        </p>
                        {file.clienteId && <p style={{fontSize:'0.7rem', color:'var(--text-muted)', marginTop:'2px'}}>Asignado al cliente ID: {file.clienteId}</p>}
                      </div>
                    </div>
                    
                    {file.data && (
                      <div style={{ textAlign: 'right', display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <div style={{ textAlign: 'left' }}>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Emisor</p>
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>{file.data.razon_social}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>CUIT: {file.data.cuit_emisor}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontWeight: 600, color: 'var(--success)', margin: 0, fontSize: '1.1rem' }}>{formatMoney(file.data.total)}</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>IVA: {formatMoney(file.data.iva)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-1" style={{ gridColumn: 'span 1 / span 1' }}>
          <div className="card full-width">
            <h3>¿Cómo funciona?</h3>
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--primary)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>1</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Selecciona el cliente del desplegable.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--primary)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>2</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sube la foto del ticket. La caja se activará una vez elegido el cliente.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ background: 'var(--primary)', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', flexShrink: 0 }}>3</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>La IA leerá los montos y los guardará en la base de datos de ese cliente.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
