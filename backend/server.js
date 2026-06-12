const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/parse-ticket', upload.single('ticketImage'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ninguna imagen' });
  await new Promise(r => setTimeout(r, 2500));
  const totalAleatorio = (Math.random() * 50000 + 1000).toFixed(2);
  const ivaCalculado = (totalAleatorio * 0.21).toFixed(2);
  const neto = (totalAleatorio - ivaCalculado).toFixed(2);
  res.json({
    success: true,
    data: {
      cuit_emisor: '30-54668997-9',
      razon_social: 'YPF S.A. (Estación de Servicio)',
      fecha: new Date().toLocaleDateString(),
      neto: parseFloat(neto),
      iva: parseFloat(ivaCalculado),
      total: parseFloat(totalAleatorio),
      categoria: 'Combustibles'
    }
  });
});

app.post('/api/sync-afip', async (req, res) => {
  const { cuit, clave_fiscal, fechaDesde, fechaHasta } = req.body;
  if (!cuit || !clave_fiscal) return res.status(400).json({ error: 'Faltan credenciales' });

  // Función para pasar de YYYY-MM-DD a DD/MM/YYYY
  const parseDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };
  
  const fDesde = parseDate(fechaDesde);
  const fHasta = parseDate(fechaHasta);
  const fechaAfip = fDesde && fHasta ? `${fDesde} - ${fHasta}` : null;

  let browser;
  try {
    console.log(`\n==============================================`);
    console.log(`[BOT] INICIANDO EXTRACCIÓN REAL PARA CUIT: ${cuit}`);
    console.log(`[BOT] RANGO DE FECHAS: ${fechaAfip || 'Por defecto de AFIP'}`);
    console.log(`==============================================`);
    
    browser = await puppeteer.launch({ 
      headless: false, 
      defaultViewport: null,
      args: ['--start-minimized'] // Mantiene el navegador oculto en la barra de tareas
    });
    const page = await browser.newPage();
    
    const downloadPath = path.resolve(__dirname, 'downloads');
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);
    // Limpiamos la carpeta de descargas antes de empezar para no mezclar archivos viejos
    const oldFiles = fs.readdirSync(downloadPath).filter(f => f.endsWith('.zip'));
    for (const file of oldFiles) fs.unlinkSync(path.join(downloadPath, file));

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadPath });

    // 1. LOGIN
    console.log('[BOT] -> Paso 1: Navegando a Login AFIP...');
    await page.goto('https://auth.afip.gob.ar/contribuyente_/login.xhtml', { waitUntil: 'networkidle2' });

    console.log('[BOT] -> Paso 2: Ingresando CUIT...');
    await page.waitForSelector('input[name="F1:username"]');
    await page.type('input[name="F1:username"]', cuit, { delay: 30 });
    await page.click('input[id="F1:btnSiguiente"]');

    console.log('[BOT] -> Paso 3: Ingresando Clave Fiscal...');
    await page.waitForSelector('input[name="F1:password"]', { visible: true });
    await page.type('input[name="F1:password"]', clave_fiscal, { delay: 30 });
    await page.click('input[id="F1:btnIngresar"]');

    console.log('[BOT] -> Paso 4: Esperando validación de portal principal...');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('[BOT] ¡Login exitoso! Estamos en el portal.');

    // 2. BUSCADOR
    console.log('[BOT] -> Paso 5: Escribiendo "Mis Comprobantes" en el Buscador...');
    await page.waitForSelector('#buscadorInput', { visible: true });
    await page.click('#buscadorInput');
    await new Promise(r => setTimeout(r, 1000));
    await page.type('#buscadorInput', 'Mis Comprobantes', { delay: 100 });
    
    console.log('[BOT] -> Esperando los resultados del menú desplegable...');
    await new Promise(r => setTimeout(r, 2000));
    await page.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 500));
    
    const targetPromise = new Promise(resolve => browser.once('targetcreated', resolve));
    console.log('[BOT] -> Presionando ENTER en el resultado del buscador...');
    await page.keyboard.press('Enter');
    
    const newTarget = await targetPromise;
    const newPage = await newTarget.page();
    
    console.log('[BOT] -> Esperando 15 segundos a que cargue la SPA de Mis Comprobantes...');
    await new Promise(r => setTimeout(r, 15000));

    // ================= EXTRACCIÓN EMITIDOS =================
    console.log(`[BOT] -> Paso 6: Extrayendo EMITIDOS (Ventas) para el periodo ${fechaAfip}...`);
    await newPage.evaluate(() => document.getElementById('btnEmitidos').click());
    await new Promise(r => setTimeout(r, 5000));
    
    // Inyectar el rango de fechas dinámico
    if (fechaAfip) {
      await newPage.evaluate((fecha) => {
        const input = document.getElementById('fechaEmision');
        if(input) {
          input.value = fecha;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, fechaAfip);
    }

    await newPage.evaluate(() => document.getElementById('buscarComprobantes').click());
    console.log('[BOT] -> Esperando grilla de resultados (Ventas)...');
    await new Promise(r => setTimeout(r, 5000));

    await newPage.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const btnCSV = links.find(el => el.textContent.includes('CSV') || (el.title && el.title.includes('CSV')));
      if (btnCSV) btnCSV.click();
    });
    console.log('[BOT] -> ¡CSV de Ventas descargándose! Pausando 5 segundos...');
    await new Promise(r => setTimeout(r, 5000));

    // ================= EXTRACCIÓN RECIBIDOS =================
    console.log('[BOT] -> Paso 7: Volviendo al inicio de Mis Comprobantes para extraer RECIBIDOS (Compras)...');
    await newPage.goto('https://fes.afip.gob.ar/mcmp/jsp/index.do', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 8000)); // Esperar a que recargue la SPA

    console.log('[BOT] -> Haciendo clic en "Recibidos"...');
    await newPage.evaluate(() => document.getElementById('btnRecibidos').click());
    await new Promise(r => setTimeout(r, 5000));

    // Inyectar el rango de fechas dinámico
    if (fechaAfip) {
      await newPage.evaluate((fecha) => {
        const input = document.getElementById('fechaEmision');
        if(input) {
          input.value = fecha;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, fechaAfip);
    }

    await newPage.evaluate(() => document.getElementById('buscarComprobantes').click());
    console.log('[BOT] -> Esperando grilla de resultados (Compras)...');
    await new Promise(r => setTimeout(r, 5000));

    await newPage.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const btnCSV = links.find(el => el.textContent.includes('CSV') || (el.title && el.title.includes('CSV')));
      if (btnCSV) btnCSV.click();
    });
    console.log('[BOT] -> ¡CSV de Compras descargándose! Pausando 5 segundos...');
    await new Promise(r => setTimeout(r, 5000));

    // ================= LECTURA DE ARCHIVOS =================
    console.log('[BOT] -> Analizando los archivos ZIP descargados...');
    const AdmZip = require('adm-zip');
    const downloadedFiles = fs.readdirSync(downloadPath);
    
    const zipEmitidos = downloadedFiles.find(f => f.endsWith('.zip') && f.includes('emitidos'));
    const zipRecibidos = downloadedFiles.find(f => f.endsWith('.zip') && f.includes('recibidos'));
    
    const parseZipCSV = (fileName) => {
      let stats = { 
        totalNetoGravado: 0, 
        totalIVA: 0, 
        totalNoGravado: 0,
        totalExento: 0,
        totalPercepcionesNacionales: 0,
        totalPercepcionesIIBB: 0,
        totalPercepcionesMunicipales: 0,
        totalImpuestosInternos: 0,
        cantidadComprobantes: 0, 
        lista: [] 
      };
      if (!fileName) return stats;
      
      try {
        const zip = new AdmZip(path.join(downloadPath, fileName));
        const csvEntry = zip.getEntries().find(e => e.entryName.endsWith('.csv'));
        if (csvEntry) {
          const lines = zip.readAsText(csvEntry, 'utf8').split('\n');
          if (lines.length > 1) {
            const headers = lines[0].split(';');
            const idxFecha = headers.indexOf('"Fecha de Emisión"');
            const idxTipoComp = headers.indexOf('"Tipo de Comprobante"');
            const idxPuntoVenta = headers.indexOf('"Punto de Venta"');
            const idxNumero = headers.indexOf('"Número Desde"') !== -1 ? headers.indexOf('"Número Desde"') : headers.indexOf('"Nro. Desde"');
            const idxCuitRec = headers.indexOf('"Nro. Doc. Receptor"');
            const idxCuitEmi = headers.indexOf('"Nro. Doc. Emisor"');
            const idxRazonRec = headers.indexOf('"Denominación Receptor"');
            const idxRazonEmi = headers.indexOf('"Denominación Emisor"');
            const idxNeto = headers.indexOf('"Imp. Neto Gravado Total"');
            const idxNoGravado = headers.indexOf('"Imp. Tot. Conc. No Gravados"');
            const idxExento = headers.indexOf('"Imp. Op. Exentas"');
            const idxPercNac = headers.indexOf('"Percepciones Nacionales"');
            const idxPercIIBB = headers.indexOf('"Percepciones Ingresos Brutos"');
            const idxPercMun = headers.indexOf('"Percepciones Impuestos Municipales"');
            const idxImpInt = headers.indexOf('"Impuestos Internos"');
            const idxIva = headers.indexOf('"Total IVA"');
            const idxTotal = headers.indexOf('"Imp. Total"');

            // Alícuotas
            const idxIva105 = headers.indexOf('"IVA 10,5%"');
            const idxNeto105 = headers.indexOf('"Imp. Neto Gravado IVA 10,5%"');
            const idxIva21 = headers.indexOf('"IVA 21%"');
            const idxNeto21 = headers.indexOf('"Imp. Neto Gravado IVA 21%"');
            const idxIva27 = headers.indexOf('"IVA 27%"');
            const idxNeto27 = headers.indexOf('"Imp. Neto Gravado IVA 27%"');
            
            if (idxNeto !== -1 && idxIva !== -1) {
              for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '') continue;
                const cols = lines[i].split(';');
                if (cols.length > Math.max(idxNeto, idxIva)) {
                  const parseNum = (idx) => {
                    if (idx === -1 || !cols[idx]) return 0;
                    return parseFloat(cols[idx].replace(',', '.').replace(/"/g, '')) || 0;
                  };

                  let neto = parseNum(idxNeto);
                  let noGravado = parseNum(idxNoGravado);
                  let exento = parseNum(idxExento);
                  let percNac = parseNum(idxPercNac);
                  let percIIBB = parseNum(idxPercIIBB);
                  let percMun = parseNum(idxPercMun);
                  let impInt = parseNum(idxImpInt);
                  let iva = parseNum(idxIva);
                  let total = parseNum(idxTotal);
                  
                  stats.totalNetoGravado += neto;
                  stats.totalNoGravado += noGravado;
                  stats.totalExento += exento;
                  stats.totalPercepcionesNacionales += percNac;
                  stats.totalPercepcionesIIBB += percIIBB;
                  stats.totalPercepcionesMunicipales += percMun;
                  stats.totalImpuestosInternos += impInt;
                  stats.totalIVA += iva;
                  stats.cantidadComprobantes++;
                  
                  // Detalle de lista
                  const colCuit = (idxCuitRec !== -1 && cols[idxCuitRec] && cols[idxCuitRec] !== '""') ? cols[idxCuitRec] : (idxCuitEmi !== -1 && cols[idxCuitEmi] ? cols[idxCuitEmi] : '');
                  const colRazon = (idxRazonRec !== -1 && cols[idxRazonRec] && cols[idxRazonRec] !== '""') ? cols[idxRazonRec] : (idxRazonEmi !== -1 && cols[idxRazonEmi] ? cols[idxRazonEmi] : '');
                  
                  stats.lista.push({
                    fecha: idxFecha !== -1 && cols[idxFecha] ? cols[idxFecha].replace(/"/g, '') : '',
                    tipoComp: idxTipoComp !== -1 && cols[idxTipoComp] ? cols[idxTipoComp].replace(/"/g, '') : '',
                    puntoVenta: idxPuntoVenta !== -1 && cols[idxPuntoVenta] ? cols[idxPuntoVenta].replace(/"/g, '') : '',
                    numero: idxNumero !== -1 && cols[idxNumero] ? cols[idxNumero].replace(/"/g, '') : '',
                    cuit: colCuit.replace(/"/g, ''),
                    razon_social: colRazon.replace(/"/g, ''),
                    neto: neto,
                    noGravado: noGravado,
                    exento: exento,
                    percNac: percNac,
                    percIIBB: percIIBB,
                    percMun: percMun,
                    impInt: impInt,
                    iva: iva,
                    total: total,
                    // Desglose Alícuotas
                    neto105: parseNum(idxNeto105),
                    iva105: parseNum(idxIva105),
                    neto21: parseNum(idxNeto21),
                    iva21: parseNum(idxIva21),
                    neto27: parseNum(idxNeto27),
                    iva27: parseNum(idxIva27)
                  });
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error leyendo ${fileName}:`, e);
      }
      return stats;
    };

    const realVentas = parseZipCSV(zipEmitidos);
    const realCompras = parseZipCSV(zipRecibidos);
    
    console.log(`[BOT] -> ¡Lectura Exitosa! Ventas Reales: $${realVentas.totalNetoGravado} | Compras Reales: $${realCompras.totalNetoGravado}`);

    await browser.close();

    res.json({ 
      success: true, 
      mensaje: `¡Descarga Real! ${realVentas.cantidadComprobantes} Ventas y ${realCompras.cantidadComprobantes} Compras`,
      ventas: realVentas,
      compras: realCompras
    });

  } catch (error) {
    console.error('[BOT] Error durante la extracción:', error);
    if (browser) await browser.close();
    res.status(500).json({ error: 'Fallo al sincronizar. Error: ' + error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🤖 Robot AFIP Extractor corriendo en http://localhost:${PORT}`);
});
