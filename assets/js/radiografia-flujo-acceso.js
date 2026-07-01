/**
 * RADIOGRAFIA-FLUJO-ACCESO.JS
 * Maestro de control de acceso para radiografías PRIVADAS vs PUBLICAS
 * Consultora Diagonales | Paleta CODEX
 * 
 * Este script debe ejecutarse ANTES de intentar cargar una radiografía.
 * 
 * USO:
 * const flujo = new RadiografiaFlujoAcceso();
 * flujo.manejarClickRadiografia(radiografiaId, titulo, estado);
 */

class RadiografiaFlujoAcceso {
  constructor() {
    this.radiografiasData = {}; // Cache de radiografías
    this.init();
  }

  init() {
    // Event listener para clicks en radiografías
    document.addEventListener('click', (e) => {
      const card = e.target.closest('[data-radiografia-id]');
      if (card) {
        e.preventDefault();
        const radiografiaId = card.dataset.radiografiaId;
        const titulo = card.dataset.radiografiaTitulo || 'Radiografía';
        const estado = card.dataset.radiografiaEstado || 'PUBLICO';
        
        this.manejarClickRadiografia(radiografiaId, titulo, estado);
      }
    });

    // Escuchar cuando acceso es aprobado
    window.addEventListener('radiografia-acceso-aprobado', (e) => {
      this.abrirVisor(e.detail.radiografiaId);
    });

    console.log('✓ RadiografiaFlujoAcceso inicializado');
  }

  /**
   * MÉTODO PRINCIPAL: Validar si radiografía es PRIVADA o PUBLICA
   * y actuar en consecuencia
   */
  manejarClickRadiografia(radiografiaId, titulo, estado) {
    console.log(`📋 Click en radiografía: ${titulo} (${estado})`);

    // CASO 1: RADIOGRAFÍA PÚBLICA → Abrir directamente
    if (estado === 'PUBLICO' || estado === 'PUBLIC') {
      console.log('✓ Radiografía pública → Abriendo visor');
      this.abrirVisor(radiografiaId);
      return;
    }

    // CASO 2: RADIOGRAFÍA PRIVADA → Validar acceso
    if (estado === 'PRIVADO' || estado === 'PRIVATE') {
      console.log('🔐 Radiografía privada → Validando acceso');
      this.validarAccesoPrivado(radiografiaId, titulo);
      return;
    }

    console.warn('⚠ Estado desconocido:', estado);
  }

  /**
   * VALIDAR ACCESO A RADIOGRAFÍA PRIVADA
   */
  validarAccesoPrivado(radiografiaId, titulo) {
    // Verificar si ya tiene token guardado
    const token = SolicitudDatosPopup.verificarAcceso(radiografiaId);

    if (token) {
      console.log('✓ Token válido en localStorage → Abriendo visor');
      this.abrirVisor(radiografiaId);
      return;
    }

    console.log('❌ Sin token → Mostrando popup de solicitud');
    
    // Mostrar popup de solicitud
    new SolicitudDatosPopup(radiografiaId, titulo, 'PRIVADO');
  }

  /**
   * ABRIR EL VISOR DE RADIOGRAFÍAS
   * Este es el punto de conexión con tu visor existente
   */
  abrirVisor(radiografiaId) {
    console.log(`📂 Abriendo visor para radiografía: ${radiografiaId}`);

    // OPCIÓN A: Si tienes un visor en modal
    this.abrirVisiorEnModal(radiografiaId);

    // OPCIÓN B: Si redirige a página separada
    // window.location.href = `/visor/radiografia.html?id=${radiografiaId}`;
  }

  /**
   * Abrir visor en modal (compatible con tu diseño)
   */
  abrirVisiorEnModal(radiografiaId) {
    // Limpiar visor anterior si existe
    const visiorAnterior = document.getElementById('radiografia-visor-modal');
    if (visiorAnterior) visiorAnterior.remove();

    // Crear modal del visor
    const backdrop = document.createElement('div');
    backdrop.id = 'visor-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(8, 35, 90, 0.9);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const visor = document.createElement('div');
    visor.id = 'radiografia-visor-modal';
    visor.style.cssText = `
      width: 95%;
      height: 95vh;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      box-shadow: 0 40px 80px rgba(0, 0, 0, 0.4);
    `;

    // Header del visor
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #003A90 0%, #041B2C 100%);
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 60px;
    `;

    header.innerHTML = `
      <div>
        <h3 style="margin: 0; font-size: 18px; font-weight: 700;">Radiografía</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #B7E6FF;">ID: ${radiografiaId}</p>
      </div>
      <button id="btn-cerrar-visor" style="
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 28px;
        cursor: pointer;
        width: 40px;
        height: 40px;
        border-radius: 8px;
        transition: all 0.2s;
      ">×</button>
    `;

    // Iframe del visor (ajusta tu endpoint)
    const iframe = document.createElement('iframe');
    iframe.src = `/radiografias/${radiografiaId}/index.html`;
    iframe.style.cssText = `
      width: 100%;
      height: calc(100% - 60px);
      border: none;
    `;

    visor.appendChild(header);
    visor.appendChild(iframe);
    backdrop.appendChild(visor);
    document.body.appendChild(backdrop);

    // Cerrar visor
    document.getElementById('btn-cerrar-visor').addEventListener('click', () => {
      backdrop.remove();
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });

    // Tecla ESC para cerrar
    const cerrarConEsc = (e) => {
      if (e.key === 'Escape') {
        backdrop.remove();
        document.removeEventListener('keydown', cerrarConEsc);
      }
    };
    document.addEventListener('keydown', cerrarConEsc);
  }

  /**
   * BONUS: Método para pre-cargar metadata de radiografías
   * Útil si tienes un API endpoint
   */
  async cargarMetadataRadiografias() {
    try {
      const response = await fetch('/api/radiografias');
      const data = await response.json();
      this.radiografiasData = data;
      console.log('✓ Metadata de radiografías cargada', data);
    } catch (error) {
      console.warn('⚠ No se pudo cargar metadata:', error);
    }
  }

  /**
   * BONUS: Cerrar sesión / Limpiar acceso
   */
  logout(radiografiaId) {
    SolicitudDatosPopup.limpiarToken(radiografiaId);
    console.log(`🔓 Token limpiado para radiografía: ${radiografiaId}`);
  }
}

// INICIALIZAR GLOBALMENTE
window.radiografiaFlujo = new RadiografiaFlujoAcceso();

// Exportar para debug
window.RadiografiaFlujoAcceso = RadiografiaFlujoAcceso;
