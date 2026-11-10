// ===== JS de nueva-password.html =====
// Usa "cliente", que viene de js/supabase.js (por eso ese archivo se carga antes)
//
// Se llega acá desde el link del mail de "¿Olvidaste tu contraseña?".
// Ese link trae un código en la dirección: la librería de Supabase lo lee sola
// y deja al usuario logueado "por un rato", justo para poder cambiar la contraseña.

const boton = document.getElementById('btn-guardar');
const mensaje = document.getElementById('mensaje');


// ----- 1. Al abrir: ¿viene desde el mail? -----
// Si alguien abre esta página directo (sin el link), o el link ya venció,
// no hay sesión y no se puede cambiar nada: le avisamos y ocultamos el botón

async function revisarLink() {
    const { data } = await cliente.auth.getSession();

    if (!data.session) {
        mensaje.textContent = 'Este link venció o no es válido. Volvé al login y tocá "¿Olvidaste tu contraseña?" para pedir otro mail.';
        boton.hidden = true;
    }
}
revisarLink();


// ----- 2. Guardar la contraseña nueva -----

boton.addEventListener('click', async function () {
    const password = document.getElementById('password').value;
    const confirmar = document.getElementById('confirmar').value;

    if (password.length < 6) {
        mensaje.textContent = 'La contraseña tiene que tener al menos 6 caracteres';
        return;
    }
    if (password !== confirmar) {
        // !== significa "distinto de"
        mensaje.textContent = 'Las contraseñas no coinciden';
        return;
    }

    mensaje.textContent = 'Guardando...';

    // updateUser cambia datos del usuario logueado; acá, la contraseña
    const { error } = await cliente.auth.updateUser({ password: password });

    if (error) {
        if (error.message.includes('different from the old')) {
            mensaje.textContent = 'La contraseña nueva tiene que ser distinta de la anterior';
        } else {
            mensaje.textContent = 'No se pudo cambiar. Pedí otro mail desde el login. (' + error.message + ')';
        }
    } else {
        mensaje.textContent = '¡Contraseña cambiada! Entrando...';
        window.location.href = 'inicio.html';
    }
});
