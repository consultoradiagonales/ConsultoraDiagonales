/**
 * SOLICITUD-DATOS-POPUP.JS
 * Sistema de gating para radiografías PRIVADAS
 * Consultora Diagonales | Paleta CODEX
 * 
 * Flujo:
 * 1. Usuario hace click en radiografía con estado: PRIVADO
 * 2. Script valida: ¿tiene token en localStorage?
 * 3. Si NO: muestra popup de solicitud
 * 4. Usuario completa: nombre + email + teléfono
 * 5. Script valida contra lista blanca o envía a admin
 * 6. Si aprobado: abre visor + guarda token
 * 7. Si rechazado: muestra modal de error
 */

class SolicitudDatosPopup {
  constructor(radiografiaId, radiografiaTitulo, estadoRadiografia = 'PRIVADO') {
    this.radiografiaId = radiografiaId;
    this.radiografiaTitulo = radiografiaTitulo;
    this.estado = estadoRadiografia;
    this.modal = null;
    this.formulario = null;
    this.tokenKey = `radiografia_token_${radiografiaId}`;
    this.init();
  }

  init() {
    // Crear la estructura HTML del popup
    this.crearModal();
    this.agregarEventos();
  }

  crearModal() {
    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(8, 35, 90, 0.7);
      backdrop-filter: blur(4px);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // Modal principal
    this.modal = document.createElement('div');
    this.modal.id = 'solicitud-datos-modal';
    this.modal.className = 'modal-solicit-datos';
    this.modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
      width: 90%;
      max-width: 500px;
      background: linear-gradient(135deg, #BDEAF2 0%, #CDEFF5 100%);
      border: 2px solid #009AFE;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 58, 144, 0.3);
      padding: 0;
      animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    // Estilos para animación
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translate(-50%, -60%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -50%);
        }
      }

      .modal-header-cd {
        background: linear-gradient(135deg, #003A90 0%, #041B2C 100%);
        color: white;
        padding: 28px 24px;
        border-radius: 10px 10px 0 0;
      }

      .modal-header-cd h2 {
        margin: 0;
        font-size: 22px;
        font-weight: 950;
        letter-spacing: -0.5px;
      }

      .modal-header-cd p {
        margin: 8px 0 0 0;
        font-size: 14px;
        color: #B7E6FF;
      }

      .modal-body-cd {
        padding: 28px 24px;
      }

      .form-group-cd {
        margin-bottom: 20px;
      }

      .form-group-cd label {
        display: block;
        font-weight: 700;
        color: #003A90;
        margin-bottom: 8px;
        font-size: 14px;
      }

      .form-group-cd input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid #009AFE;
        border-radius: 8px;
        font-size: 14px;
        background: white;
        color: #08235A;
        transition: all 0.2s ease;
        box-sizing: border-box;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }

      .form-group-cd input:focus {
        outline: none;
        border-color: #6ED5FF;
        box-shadow: 0 0 0 3px rgba(110, 213, 255, 0.1);
      }

      .form-group-cd input::placeholder {
        color: #385071;
      }

      .checkbox-group-cd {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
        padding: 12px;
        background: rgba(110, 213, 255, 0.05);
        border-radius: 8px;
      }

      .checkbox-group-cd input[type="checkbox"] {
        width: 20px;
        height: 20px;
        margin-top: 2px;
        cursor: pointer;
        accent-color: #009AFE;
      }

      .checkbox-group-cd label {
        margin: 0;
        font-size: 13px;
        color: #08235A;
        cursor: pointer;
      }

      .modal-buttons-cd {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #6ED5FF;
      }

      .btn-cd {
        flex: 1;
        padding: 12px 20px;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
        font-family: Inter, system-ui, -apple-system, sans-serif;
      }

      .btn-primary-cd {
        background: linear-gradient(135deg, #009AFE 0%, #0078d4 100%);
        color: white;
      }

      .btn-primary-cd:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 154, 254, 0.3);
      }

      .btn-primary-cd:active {
        transform: translateY(0);
      }

      .btn-secondary-cd {
        background: white;
        color: #003A90;
        border: 2px solid #009AFE;
      }

      .btn-secondary-cd:hover {
        background: #F0F5FB;
      }

      .modal-close-cd {
        position: absolute;
        top: 12px;
        right: 12px;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        z-index: 10000;
      }

      .modal-close-cd:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .loading-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .error-message-cd {
        color: #C62828;
        font-size: 13px;
        margin-top: 6px;
        display: none;
      }

      .success-icon-cd {
        display: inline-block;
        width: 20px;
        height: 20px;
        background: #1E8E5A;
        color: white;
        border-radius: 50%;
        text-align: center;
        line-height: 20px;
        font-size: 14px;
        margin-right: 8px;
      }
    `;
    document.head.appendChild(style);

    // Contenido del modal
    this.modal.innerHTML = `
      <button class="modal-close-cd" aria-label="Cerrar">×</button>
      
      <div class="modal-header-cd">
        <h2>🔐 Acceso Restringido</h2>
        <p>Esta radiografía es privada. Completa el formulario para solicitar acceso.</p>
      </div>

      <div class="modal-body-cd">
        <p style="color: #08235A; font-size: 14px; margin-bottom: 20px;">
          <strong>Radiografía:</strong> ${this.radiografiaTitulo}
        </p>

        <form id="form-solicitud-datos" style="margin: 0;">
          <div class="form-group-cd">
            <label for="nombre-solicitante">Tu nombre *</label>
            <input 
              type="text" 
              id="nombre-solicitante" 
              name="nombre" 
              placeholder="Ej: Juan Pérez"
              required
              autocomplete="name"
            />
            <div class="error-message-cd"></div>
          </div>

          <div class="form-group-cd">
            <label for="email-solicitante">Email *</label>
            <input 
              type="email" 
              id="email-solicitante" 
              name="email" 
              placeholder="Ej: juan@example.com"
              required
              autocomplete="email"
            />
            <div class="error-message-cd"></div>
          </div>

          <div class="form-group-cd">
            <label for="telefono-solicitante">Teléfono (opcional)</label>
            <input 
              type="tel" 
              id="telefono-solicitante" 
              name="telefono" 
              placeholder="Ej: +54 9 221 123-4567"
              autocomplete="tel"
            />
          </div>

          <div class="form-group-cd">
            <label for="organizacion-solicitante">Organización / Cargo (opcional)</label>
            <input 
              type="text" 
              id="organizacion-solicitante" 
              name="organizacion" 
              placeholder="Ej: Consultora ABC / Analista"
              autocomplete="organization"
            />
          </div>

          <div class="checkbox-group-cd">
            <input type="checkbox" id="acepta-terminos" name="terminos" required />
            <label for="acepta-terminos">
              Acepto que Consultora Diagonales puede contactarme con información sobre radiografías y servicios.
            </label>
          </div>

          <div class="modal-buttons-cd">
            <button type="button" class="btn-cd btn-secondary-cd" id="btn-cancelar">
              Cancelar
            </button>
            <button type="submit" class="btn-cd btn-primary-cd" id="btn-enviar">
              Solicitar Acceso
            </button>
          </div>
        </form>
      </div>
    `;

    // Agregar al DOM
    document.body.appendChild(backdrop);
    document.body.appendChild(this.modal);

    // Guardar referencias
    this.backdrop = backdrop;
    this.formulario = document.getElementById('form-solicitud-datos');

    // Mostrar con animación
    setTimeout(() => {
      backdrop.style.opacity = '1';
    }, 10);
  }

  agregarEventos() {
    // Cerrar modal
    const btnCerrar = this.modal.querySelector('.modal-close-cd');
    const btnCancelar = this.modal.querySelector('#btn-cancelar');

    btnCerrar.addEventListener('click', () => this.cerrar());
    btnCancelar.addEventListener('click', () => this.cerrar());

    // Cerrar al click en backdrop
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.cerrar();
    });

    // Enviar formulario
    this.formulario.addEventListener('submit', (e) => this.manejarEnvio(e));

    // Validación en tiempo real
    document.getElementById('nombre-solicitante').addEventListener('blur', (e) => {
      this.validarCampo(e.target);
    });

    document.getElementById('email-solicitante').addEventListener('blur', (e) => {
      this.validarCampo(e.target);
    });
  }

  validarCampo(campo) {
    const errorDiv = campo.parentElement.querySelector('.error-message-cd');
    
    if (campo.name === 'nombre' && campo.value.trim().length < 3) {
      errorDiv.textContent = 'El nombre debe tener al menos 3 caracteres.';
      errorDiv.style.display = 'block';
      return false;
    }

    if (campo.name === 'email' && !this.validarEmail(campo.value)) {
      errorDiv.textContent = 'Email inválido.';
      errorDiv.style.display = 'block';
      return false;
    }

    errorDiv.style.display = 'none';
    return true;
  }

  validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  }

  async manejarEnvio(e) {
    e.preventDefault();

    // Validar todos los campos
    const nombre = document.getElementById('nombre-solicitante');
    const email = document.getElementById('email-solicitante');
    const terminos = document.getElementById('acepta-terminos');

    if (!this.validarCampo(nombre)) return;
    if (!this.validarCampo(email)) return;

    if (!terminos.checked) {
      alert('Debes aceptar los términos para continuar.');
      return;
    }

    // Cambiar botón a estado loading
    const btnEnviar = this.formulario.querySelector('#btn-enviar');
    const textoOriginal = btnEnviar.textContent;
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<span class="loading-spinner"></span> Verificando...';

    try {
      // OPCIÓN 1: Validar contra lista blanca (localStorage en servidor)
      const datos = {
        radiografiaId: this.radiografiaId,
        nombre: nombre.value.trim(),
        email: email.value.trim(),
        telefono: document.getElementById('telefono-solicitante').value.trim(),
        organizacion: document.getElementById('organizacion-solicitante').value.trim(),
        timestamp: new Date().toISOString(),
      };

      // Enviar a tu backend (ajusta el endpoint)
      const response = await fetch('/api/solicitar-radiografia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datos),
      });

      if (response.ok) {
        const result = await response.json();

        // Guardar token en localStorage
        if (result.token) {
          localStorage.setItem(this.tokenKey, result.token);
        }

        // Mostrar éxito
        this.mostrarExito();
        
        // Cerrar después de 2 segundos y abrir visor
        setTimeout(() => {
          this.cerrar();
          // Disparar evento para que el visor se abra
          window.dispatchEvent(new CustomEvent('radiografia-acceso-aprobado', {
            detail: { radiografiaId: this.radiografiaId }
          }));
        }, 2000);
      } else {
        throw new Error('No autorizado para acceder a esta radiografía.');
      }
    } catch (error) {
      this.mostrarError(error.message || 'Error al procesar la solicitud.');
      btnEnviar.disabled = false;
      btnEnviar.textContent = textoOriginal;
    }
  }

  mostrarExito() {
    const body = this.modal.querySelector('.modal-body-cd');
    body.innerHTML = `
      <div style="text-align: center; padding: 40px 20px;">
        <div style="font-size: 48px; margin-bottom: 16px;">✓</div>
        <h3 style="color: #1E8E5A; margin: 0 0 12px 0; font-size: 20px;">¡Solicitud Enviada!</h3>
        <p style="color: #08235A; margin: 0; font-size: 14px;">
          Tu solicitud ha sido registrada. Accediendo a la radiografía...
        </p>
      </div>
    `;
  }

  mostrarError(mensaje) {
    const body = this.modal.querySelector('.modal-body-cd');
    const formulario = body.querySelector('#form-solicitud-datos');
    
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
      background: #FFEBEE;
      border: 2px solid #C62828;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      color: #C62828;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    `;
    alertDiv.innerHTML = `
      <span style="font-size: 18px;">⚠</span>
      <span>${mensaje}</span>
    `;

    formulario.insertBefore(alertDiv, formulario.firstChild);

    // Remover después de 6 segundos
    setTimeout(() => alertDiv.remove(), 6000);
  }

  cerrar() {
    this.backdrop.style.opacity = '0';
    setTimeout(() => {
      this.modal?.remove();
      this.backdrop?.remove();
    }, 300);
  }

  static verificarAcceso(radiografiaId) {
    const tokenKey = `radiografia_token_${radiografiaId}`;
    return localStorage.getItem(tokenKey) || null;
  }

  static limpiarToken(radiografiaId) {
    const tokenKey = `radiografia_token_${radiografiaId}`;
    localStorage.removeItem(tokenKey);
  }
}

// EXPORTAR para uso en otros scripts
window.SolicitudDatosPopup = SolicitudDatosPopup;
