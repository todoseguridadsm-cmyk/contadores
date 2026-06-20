const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navegando a Login AFIP...');
  await page.goto('https://auth.afip.gob.ar/contribuyente_/login.xhtml', { waitUntil: 'networkidle2' });

  console.log('Ingresando CUIT...');
  await page.type('input[name="F1:username"]', '20416994413');
  await page.click('input[id="F1:btnSiguiente"]');

  console.log('Ingresando Clave Fiscal sin espacio...');
  await page.waitForSelector('input[name="F1:password"]', { visible: true });
  await page.type('input[name="F1:password"]', 'Hola2011@@'); // Sin espacio
  await page.click('input[id="F1:btnIngresar"]');

  console.log('Esperando navegación...');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  console.log('Tomando captura inicial del dashboard...');
  await page.screenshot({ path: 'tomas_dashboard.png', fullPage: true });

  const text = await page.evaluate(() => document.body.innerText);
  if (text.includes('Clave o usuario incorrecto')) {
    console.log('Fallo de login - Clave incorrecta');
  } else {
    console.log('Login exitoso. Texto de la pagina (primeros 500 chars):', text.substring(0, 500));
  }

  await browser.close();
})();
