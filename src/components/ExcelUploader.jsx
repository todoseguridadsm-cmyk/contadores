import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';

export default function ExcelUploader({ onDataLoaded, title = "Cargar Excel AFIP", type = "ventas" }) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files.length) {
      processFile(files[0]);
    }
  };

  const processFile = (file) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // AFIP Excels usually have a header row somewhere, mostly row 1 or 2
      // Converting to JSON
      const json = XLSX.utils.sheet_to_json(worksheet);
      onDataLoaded(json, type);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div 
      style={{ 
        border: isDragging ? '2px dashed var(--primary)' : '1px solid var(--border-color)',
        background: isDragging ? 'var(--bg-surface-hover)' : 'var(--bg-main)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        textAlign: 'center',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        position: 'relative'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input 
        type="file" 
        accept=".xlsx, .xls" 
        onChange={handleFileChange} 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
      />
      {fileName ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle size={32} className="success-text" />
          <p style={{ margin: 0, fontWeight: 500 }}>{fileName}</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Procesado correctamente</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <FileSpreadsheet size={32} style={{ color: 'var(--text-muted)' }} />
          <p style={{ margin: 0, fontWeight: 500 }}>{title}</p>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Arrastra el Excel o haz clic</span>
        </div>
      )}
    </div>
  );
}
