import * as XLSX from 'xlsx';

/**
 * Exporta el resumen mensual del Dashboard a un archivo Excel (.xlsx)
 */
export const exportarDashboardExcel = (ventasStats, comprasStats, resultadoMensual, mesActual = "Mes Actual") => {
  // 1. Preparamos los datos en un formato amigable para la tabla Excel
  const datosResumen = [
    { Categoria: 'VENTAS', 'Neto Gravado': ventasStats.totalNetoGravado, 'IVA': resultadoMensual.ivaVentas, 'Comprobantes': ventasStats.cantidadComprobantes },
    { Categoria: 'COMPRAS', 'Neto Gravado': comprasStats.totalNetoGravado, 'IVA': resultadoMensual.ivaCompras, 'Comprobantes': comprasStats.cantidadComprobantes },
    { Categoria: '', 'Neto Gravado': '', 'IVA': '', 'Comprobantes': '' }, // Fila vacía
    { Categoria: 'SALDOS', 'Neto Gravado': 'Posición Mensual', 'IVA': resultadoMensual.posicionMensual, 'Comprobantes': '' },
    { Categoria: 'SALDOS', 'Neto Gravado': 'Saldo a Favor Anterior', 'IVA': resultadoMensual.posicionMensual - resultadoMensual.saldoPagar, 'Comprobantes': '' },
    { Categoria: 'RESULTADO FINAL', 'Neto Gravado': 'IVA A PAGAR', 'IVA': resultadoMensual.saldoPagar, 'Comprobantes': '' },
    { Categoria: 'RESULTADO FINAL', 'Neto Gravado': 'NUEVO SALDO A FAVOR', 'IVA': resultadoMensual.nuevoSaldoAFavor, 'Comprobantes': '' }
  ];

  // 2. Creamos una hoja de trabajo (worksheet)
  const ws = XLSX.utils.json_to_sheet(datosResumen);

  // 3. Ajustamos el ancho de las columnas para que se vea bien
  ws['!cols'] = [
    { wch: 20 }, // Categoria
    { wch: 25 }, // Neto Gravado
    { wch: 20 }, // IVA
    { wch: 15 }  // Comprobantes
  ];

  // 4. Creamos el libro de trabajo (workbook) y le añadimos la hoja
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Resumen IVA');

  // 5. Descargamos el archivo
  XLSX.writeFile(wb, `Resumen_IVA_${mesActual}.xlsx`);
};

/**
 * Exporta los tickets procesados al formato de texto plano (.txt) 
 * requerido por el Libro IVA Digital de AFIP.
 */
export const exportarTicketsTxtAFIP = (ticketsProcesados) => {
  if (ticketsProcesados.length === 0) {
    alert("No hay tickets procesados para exportar.");
    return;
  }

  // Estructura simplificada del TXT de Compras (Libro IVA Digital).
  // AFIP requiere una longitud de caracteres exacta y rellenar con ceros o espacios.
  // Como esto es un MVP, haremos un formato básico delimitado o el estándar de ancho fijo simplificado.
  
  let txtContent = "";

  ticketsProcesados.forEach(ticket => {
    if(!ticket.data) return;
    
    // Ejemplo de formato de línea (simplificado):
    // Fecha (8) | Tipo (3) | Punto Venta (5) | Nro (20) | CUIT Vendedor (11) | Nombre (30) | Total (15) | No Gravado (15) | Neto (15) | IVA (15)
    
    const fechaFormat = ticket.data.fecha.replace(/\//g, '').padEnd(8, '0'); // ej: 12062026
    const cuitFormat = ticket.data.cuit_emisor.replace(/-/g, '').padEnd(11, '0');
    const razonFormat = (ticket.data.razon_social || '').substring(0, 30).padEnd(30, ' ');
    const totalFormat = (ticket.data.total * 100).toFixed(0).padStart(15, '0'); // AFIP usa enteros para centavos (ej: 100,50 -> 000000000010050)
    const netoFormat = (ticket.data.neto * 100).toFixed(0).padStart(15, '0');
    const ivaFormat = (ticket.data.iva * 100).toFixed(0).padStart(15, '0');

    // Código de comprobante inventado para el ticket (ej 083 - Ticket Factura B)
    const linea = `${fechaFormat}0830000100000000000000000001${cuitFormat}${razonFormat}${totalFormat}000000000000000000000000000000${netoFormat}${ivaFormat}\n`;
    txtContent += linea;
  });

  // Crear archivo y descargarlo
  const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Libro_IVA_Compras_Digital.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
