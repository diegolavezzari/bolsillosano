// ===== JS de login.html =====
// Usa "cliente", que viene de js/supabase.js (por eso ese archivo se carga antes)

const boton = document.getElementById('btn-ingresar');
const mensaje = document.getElementById('mensaje');

boton.addEventListener('click', async function () {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // || significa "o": si el email está vacío O la contraseña está vacía
    if (email === '' || password === '') {
        mensaje.textContent = 'Completá tu email y contraseña';
        return;
    }

    mensaje.textContent = 'Ingresando...';

    const { error } = await cliente.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        if (error.message.includes('Invalid login credentials')) {
            mensaje.textContent = 'Email o contraseña incorrectos';
        } else if (error.message.includes('Email not confirmed')) {
            mensaje.textContent = 'Todavía no confirmaste tu mail. Revisá tu casilla (y el spam).';
        } else {
            mensaje.textContent = 'Hubo un problema: ' + error.message;
        }
    } else {
        // Entró: Supabase ya guardó la sesión en el navegador
        window.location.href = 'inicio.html';
    }
});


// ----- Olvidé mi contraseña -----

const linkOlvide = document.getElementById('link-olvide');

linkOlvide.addEventListener('click', async function (evento) {
    evento.preventDefault();   // que el href="#" no salte arriba de la página

    const email = document.getElementById('email').value;
    if (email === '') {
        mensaje.textContent = 'Escribí tu email arriba y volvé a tocar "¿Olvidaste tu contraseña?"';
        return;
    }

    // El link del mail lleva a nueva-password.html (al lado de esta página)
    const volverA = new URL('nueva-password.html', window.location.href).href;

    const { error } = await cliente.auth.resetPasswordForEmail(email, {
        redirectTo: volverA
    });

    if (error) {
        mensaje.textContent = 'Hubo un problema: ' + error.message;
    } else {
        // No decimos "ese mail no existe": así nadie puede averiguar qué mails están registrados
        mensaje.textContent = 'Si ese mail tiene cuenta, te llegó un link para cambiar la contraseña.';
    }
});


// ----- Si ya está logueado, no tiene sentido ver el login -----

async function revisarSesion() {
    const { data } = await cliente.auth.getSession();
    if (data.session) {
        window.location.href = 'inicio.html';
    }
}
revisarSesion();
