import React, { useState, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, CheckCircle, AlertCircle, Trash2, Upload, Plus, X, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { procesarComprobantes } from '../utils/calculos';
import { obtenerCodigo3DCliente } from './ClientesView';

export default function TicketsView() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [selectedClientSearchText, setSelectedClientSearchText] = useState('');

  const handleUpdateTicketField = (id, field, value) => {
    setUploadedFiles(prev => prev.map(f => {
      if (f.id === id) {
        const updatedData = { ...f.data };
        if (['tipoComp', 'fecha', 'razon_social', 'cuit_emisor', 'puntoVenta', 'numero'].includes(field)) {
          updatedData[field] = value;
        } else {
          updatedData[field] = parseFloat(value) || 0;
        }
        
        // Auto-calcular Neto: neto = total - iva - no_gravado - exento
        if (['total', 'iva', 'no_gravado', 'exento'].includes(field)) {
          const tot = parseFloat(field === 'total' ? value : (updatedData.total || 0)) || 0;
          const iva = parseFloat(field === 'iva' ? value : (updatedData.iva || 0)) || 0;
          const noGrav = parseFloat(field === 'no_gravado' ? value : (updatedData.no_gravado || 0)) || 0;
          const exen = parseFloat(field === 'exento' ? value : (updatedData.exento || 0)) || 0;
          updatedData.neto = Number((tot - iva - noGrav - exen).toFixed(2));
        }
        
        return { ...f, data: updatedData };
      }
      return f;
    }));
  };

  // Estado para Carga Manual
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    razon_social: '',
    cuit_emisor: '',
    tipoComp: 'Factura B',
    puntoVenta: '0001',
    numero: '',
    total: '',
    iva: '',
    no_gravado: '',
    exento: ''
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
    const netoCalc = (parseFloat(manualForm.total || 0) - parseFloat(manualForm.iva || 0) - parseFloat(manualForm.no_gravado || 0) - parseFloat(manualForm.exento || 0)).toFixed(2);

    const manualTicket = {
      id: Math.random().toString(36).substring(7),
      name: 'Carga Manual',
      status: 'Verificar',
      clienteId: selectedCliente,
      data: {
        fecha: fechaFormat,
        fechaDb: manualForm.fecha,
        razon_social: manualForm.razon_social,
        cuit_emisor: manualForm.cuit_emisor,
        tipoComp: manualForm.tipoComp,
        puntoVenta: manualForm.puntoVenta.padStart(5, '0'),
        numero: manualForm.numero.padStart(8, '0'),
        total: parseFloat(manualForm.total || 0),
        iva: parseFloat(manualForm.iva || 0),
        no_gravado: parseFloat(manualForm.no_gravado || 0),
        exento: parseFloat(manualForm.exento || 0),
        neto: parseFloat(netoCalc)
      }
    };

    setUploadedFiles(prev => [...prev, manualTicket]);
    setShowManualModal(false);
    setManualForm({ 
      fecha: new Date().toISOString().split('T')[0], 
      razon_social: '', cuit_emisor: '', tipoComp: 'Factura B', 
      puntoVenta: '0001', numero: '', total: '', iva: '', no_gravado: '', exento: '' 
    });
  };

  const handleSubirABaseDeDatos = async () => {
    const ticketsParaSubir = uploadedFiles.filter(f => f.status === 'Verificar' && f.data);
    
    if (ticketsParaSubir.length === 0) return;
    
    setIsUploadingToDB(true);

    try {
      // 1. Guardar en Libro IVA Compras (compras_json) del Cliente en Supabase
      const clienteId = selectedCliente || ticketsParaSubir[0]?.clienteId;
      if (clienteId && import.meta.env.VITE_SUPABASE_URL) {
        const { data: clienteData } = await supabase
          .from('clientes')
          .select('compras_json')
          .eq('id', clienteId)
          .single();

        const comprasActuales = clienteData?.compras_json?.lista || [];
        const nuevosItems = ticketsParaSubir.map(ticket => ({
          fecha: ticket.data.fecha || new Date().toLocaleDateString('es-AR'),
          tipoComp: ticket.data.tipoComp || 'Factura B',
          puntoVenta: String(ticket.data.puntoVenta || '0001').padStart(4, '0'),
          numero: String(ticket.data.numero || '').padStart(8, '0'),
          cuit: (ticket.data.cuit_emisor || '').replace(/\D/g, ''),
          razon_social: ticket.data.razon_social || 'Comercio Ticket',
          neto: Number(ticket.data.neto || 0),
          noGravado: Number(ticket.data.no_gravado || 0),
          exento: Number(ticket.data.exento || 0),
          iva: Number(ticket.data.iva || 0),
          total: Number(ticket.data.total || 0),
          origen: 'foto'
        }));

        const listaCombinada = [...comprasActuales, ...nuevosItems];
        const nuevoResumenCompras = procesarComprobantes(listaCombinada);

        await supabase
          .from('clientes')
          .update({ compras_json: nuevoResumenCompras })
          .eq('id', clienteId);
      }

      // 2. Opcional: Insertar también en tabla comprobantes si existe (no fallar si no existe)
      try {
        const dbPayload = ticketsParaSubir.map(ticket => {
          let fechaDb = ticket.data.fechaDb || new Date().toISOString().split('T')[0];
          const parts = (ticket.data.fecha || '').split('/');
          if (parts.length === 3) {
            fechaDb = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
          }
          return {
            cliente_id: ticket.clienteId,
            tipo: 'recibido',
            fecha: fechaDb,
            punto_venta: '00001',
            numero: Math.floor(Math.random() * 100000).toString().padStart(8, '0'),
            tipo_comprobante: '006',
            razon_social_emisor: ticket.data.razon_social,
            cuit_emisor: (ticket.data.cuit_emisor || '').replace(/\D/g, ''),
            neto_gravado: ticket.data.neto,
            no_gravado: ticket.data.no_gravado || 0,
            exento: ticket.data.exento || 0,
            iva: ticket.data.iva,
            total: ticket.data.total,
            neto21: ticket.data.neto, 
            iva21: ticket.data.iva
          };
        });
        await supabase.from('comprobantes').insert(dbPayload);
      } catch (tableErr) {
        // Ignoramos error de schema cache si la tabla comprobantes no existe
      }

      // Si fue exitoso, cambiamos el estado visual
      setUploadedFiles(prev => prev.map(f => {
        if (f.status === 'Verificar') return { ...f, status: '¡Subido!' };
        return f;
      }));

      alert("✅ ¡Tickets guardados e integrados exitosamente al Libro IVA Compras del cliente!");
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
            <div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
              <input 
                list="clientes-list"
                className="input-field" 
                placeholder="Escribe nombre, CUIT o #ID para buscar..."
                value={selectedClientSearchText}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedClientSearchText(val);
                  const match = clientes.find(c => `${c.nombre} (CUIT: ${c.cuit})` === val || c.id == val || String(c.id) === val || c.cuit === val || c.nombre === val);
                  if (match) {
                    setSelectedCliente(match.id);
                  }
                }}
                style={{ width: '100%' }}
              />
              <datalist id="clientes-list">
                {clientes.map(c => (
                  <option key={c.id} value={`${c.nombre} (CUIT: ${c.cuit})`}>#{obtenerCodigo3DCliente(c)}</option>
                ))}
              </datalist>
              {selectedCliente && (
                <div style={{ marginTop: '0.75rem', color: 'var(--success)', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} /> Cliente seleccionado: {clientes.find(c => c.id === selectedCliente)?.nombre}
                </div>
              )}
            </div>
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
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '1000px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 0.5rem', width: '120px' }}>Archivo</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '110px' }}>Tipo</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '140px' }}>Punto Venta - Nro</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '220px' }}>Emisor (Razón / CUIT)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '100px' }}>Fecha</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '80px', textAlign: 'right' }}>IVA ($)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '80px', textAlign: 'right' }}>No Grav. ($)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '80px', textAlign: 'right' }}>Exento ($)</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '80px', textAlign: 'right' }}>Neto Calc.</th>
                      <th style={{ padding: '0.75rem 0.5rem', width: '85px', textAlign: 'right' }}>Total ($)</th>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '60px' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadedFiles.map(file => (
                      <tr key={file.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ImageIcon size={16} className={file.status === '¡Subido!' ? "success-text" : "primary-text"} />
                            <span style={{ maxWidth: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                              {file.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.7rem', color: file.status === '¡Subido!' ? 'var(--success)' : file.status === 'Error' ? 'var(--danger)' : 'var(--warning)' }}>
                            {file.status}
                          </span>
                        </td>

                        {file.data ? (
                          <>
                            {/* TIPO */}
                            <td style={{ padding: '0.5rem' }}>
                              {file.status === '¡Subido!' ? (
                                <span>{file.data.tipoComp}</span>
                              ) : (
                                <select 
                                  className="input-field" 
                                  style={{ padding: '0.2rem', fontSize: '0.8rem', width: '100%', minHeight: 'auto' }}
                                  value={file.data.tipoComp || 'Factura B'} 
                                  onChange={(e) => handleUpdateTicketField(file.id, 'tipoComp', e.target.value)}
                                >
                                  <option value="Factura A">Factura A</option>
                                  <option value="Factura B">Factura B</option>
                                  <option value="Factura C">Factura C</option>
                                  <option value="Nota de Credito A">Nota de Crédito A</option>
                                  <option value="Nota de Credito B">Nota de Crédito B</option>
                                  <option value="Nota de Credito C">Nota de Crédito C</option>
                                  <option value="Nota de Debito">Nota de Débito</option>
                                  <option value="Ticket">Ticket</option>
                                </select>
                              )}
                            </td>
                            
                            {/* PV - NRO */}
                            <td style={{ padding: '0.5rem' }}>
                              {file.status === '¡Subido!' ? (
                                <span>{file.data.puntoVenta}-{file.data.numero}</span>
                              ) : (
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <input 
                                    type="text" 
                                    className="input-field" 
                                    style={{ padding: '0.2rem', fontSize: '0.8rem', width: '45px', textAlign: 'center' }} 
                                    value={file.data.puntoVenta || ''} 
                                    onChange={(e) => handleUpdateTicketField(file.id, 'puntoVenta', e.target.value)}
                                    placeholder="PV"
                                  />
                                  <input 
                                    type="text" 
                                    className="input-field" 
                                    style={{ padding: '0.2rem', fontSize: '0.8rem', width: '80px' }} 
                                    value={file.data.numero || ''} 
                                    onChange={(e) => handleUpdateTicketField(file.id, 'numero', e.target.value)}
                                    placeholder="Número"
                                  />
                                </div>
                              )}
                            </td>

                            {/* RAZON / CUIT */}
                            <td style={{ padding: '0.5rem' }}>
                              {file.status === '¡Subido!' ? (
                                <div>
                                  <div style={{ fontWeight: 500 }}>{file.data.razon_social}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CUIT: {file.data.cuit_emisor}</div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                  <input 
                                    type="text" 
                                    className="input-field" 
                                    style={{ padding: '0.2rem', fontSize: '0.8rem', width: '100%' }} 
                                    value={file.data.razon_social || ''} 
                                    onChange={(e) => handleUpdateTicketField(file.id, 'razon_social', e.target.value)}
                                    placeholder="Razón Social"
                                  />
                                  <input 
                                    type="text" 
                                    className="input-field" 
                                    style={{ padding: '0.2rem', fontSize: '0.75rem', width: '100%' }} 
                                    value={file.data.cuit_emisor || ''} 
                                    onChange={(e) => handleUpdateTicketField(file.id, 'cuit_emisor', e.target.value)}
                                    placeholder="CUIT"
                                  />
                                </div>
                              )}
                            </td>

                            {/* FECHA */}
                            <td style={{ padding: '0.5rem' }}>
                              {file.status === '¡Subido!' ? (
                                <span>{file.data.fecha}</span>
                              ) : (
                                <input 
                                  type="text" 
                                  className="input-field" 
                                  style={{ padding: '0.2rem', fontSize: '0.8rem', width: '100%' }} 
                                  value={file.data.fecha || ''} 
                                  onChange={(e) => handleUpdateTicketField(file.id, 'fecha', e.target.value)}
                                  placeholder="DD/MM/YYYY"
                                />
                              )}
                            </td>

                            {/* IVA */}
                            <td style={{ padding: '0.5rem' }}>
                              {file.status === '¡Subido!' ? (
                                <span style={{ float: 'right' }}>{formatMoney(file.data.iva)}</span>
                              ) : (
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="input-field" 
                                  style={{ padding: '0.2rem', fontSize: '0.8rem', width: '100%', textAlign: 'right' }} 
                                  value={file.data.iva !== undefined ? file.data.iva : ''} 
                                  onChange={(e) => handleUpdateTicketField(file.id, 'iva', e.target.value)}
                                  placeholder="0.00"
                                />
                              )}
                            </td>

                            {/* NO GRAVADO */}
                            <td style={{ padding: '0.5rem' }}>
                              {file.status === '¡Subido!' ? (
                                <span style={{ float: 'right' }}>{formatMoney(file.data.no_gravado)}</span>
                              ) : (
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="input-field" 
                                  style={{ padding: '0.2rem', fontSize: '0.8rem', width: '100%', textAlign: 'right' }} 
                                  value={file.data.no_gravado !== undefined ? file.data.no_gravado : ''} 
                                  onChange={(e) => handleUpdateTicketField(file.id, 'no_gravado', e.target.value)}
                                  placeholder="0.00"
                                />
                              )}
                            </td>

                            {/* EXENTO */}
                            <td style={{ padding: '0.5rem' }}>
                              {file.status === '¡Subido!' ? (
                                <span style={{ float: 'right' }}>{formatMoney(file.data.exento)}</span>
                              ) : (
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="input-field" 
                                  style={{ padding: '0.2rem', fontSize: '0.8rem', width: '100%', textAlign: 'right' }} 
                                  value={file.data.exento !== undefined ? file.data.exento : ''} 
                                  onChange={(e) => handleUpdateTicketField(file.id, 'exento', e.target.value)}
                                  placeholder="0.00"
                                />
                              )}
                            </td>

                            {/* NETO CALC */}
                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                              {formatMoney(file.data.neto)}
                            </td>

                            {/* TOTAL */}
                            <td style={{ padding: '0.5rem' }}>
                              {file.status === '¡Subido!' ? (
                                <span style={{ fontWeight: 600, float: 'right' }}>{formatMoney(file.data.total)}</span>
                              ) : (
                                <input 
                                  type="number" 
                                  step="0.01"
                                  className="input-field" 
                                  style={{ padding: '0.2rem', fontSize: '0.8rem', width: '100%', textAlign: 'right', fontWeight: 600 }} 
                                  value={file.data.total !== undefined ? file.data.total : ''} 
                                  onChange={(e) => handleUpdateTicketField(file.id, 'total', e.target.value)}
                                  placeholder="0.00"
                                />
                              )}
                            </td>
                          </>
                        ) : (
                          <td colSpan="9" style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>
                            {file.status === 'Procesando (IA)...' ? 'Extrayendo datos con IA...' : file.errorMsg}
                          </td>
                        )}

                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
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
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Tipo Comprobante</label>
                    <select className="input-field" style={{ width: '100%' }} value={manualForm.tipoComp} onChange={e => setManualForm({...manualForm, tipoComp: e.target.value})} required>
                      <option value="Factura A">Factura A</option>
                      <option value="Factura B">Factura B</option>
                      <option value="Factura C">Factura C</option>
                      <option value="Nota de Credito A">Nota de Crédito A</option>
                      <option value="Nota de Credito B">Nota de Crédito B</option>
                      <option value="Nota de Credito C">Nota de Crédito C</option>
                      <option value="Nota de Debito">Nota de Débito</option>
                      <option value="Ticket">Ticket</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Punto Venta</label>
                    <input type="text" className="input-field" style={{ width: '100%' }} placeholder="Ej: 0001" value={manualForm.puntoVenta} onChange={e => setManualForm({...manualForm, puntoVenta: e.target.value})} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Número</label>
                    <input type="text" className="input-field" style={{ width: '100%' }} placeholder="Ej: 12345678" value={manualForm.numero} onChange={e => setManualForm({...manualForm, numero: e.target.value})} required />
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>No Gravado ($)</label>
                    <input type="number" step="0.01" className="input-field" style={{ width: '100%' }} placeholder="0.00" value={manualForm.no_gravado} onChange={e => setManualForm({...manualForm, no_gravado: e.target.value})} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Exento ($)</label>
                    <input type="number" step="0.01" className="input-field" style={{ width: '100%' }} placeholder="0.00" value={manualForm.exento} onChange={e => setManualForm({...manualForm, exento: e.target.value})} />
                  </div>
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
