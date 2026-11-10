// ===== JS de registro.html =====
// Usa "cliente", que viene de js/supabase.js (por eso ese archivo se carga antes)

const boton = document.getElementById('btn-crear');
const mensaje = document.getElementById('mensaje');

// async: adentro vamos a usar await (esperar la respuesta de Supabase)
boton.addEventListener('click', async function () {
    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmar = document.getElementById('confirmar').value;

    // 1. Validaciones de siempre (antes de molestar a Supabase)
    if (nombre === '' || email === '' || password === '') {
        mensaje.textContent = 'Completá todos los campos';
        return;   // return corta la función acá: no sigue para abajo
    }
    if (password !== confirmar) {
        // !== significa "distinto de"
        mensaje.textContent = 'Las contraseñas no coinciden';
        return;
    }
    if (password.length < 6) {
        mensaje.textContent = 'La contraseña tiene que tener al menos 6 caracteres';
        return;
    }

    mensaje.textContent = 'Creando tu cuenta...';

    // 2. A dónde vuelve el link del mail de confirmación.
    //    new URL('login.html', window.location.href) arma la dirección de login.html
    //    al lado de esta página: sirve igual en localhost y en GitHub Pages
    const volverA = new URL('login.html', window.location.href).href;

    // 3. Pedirle a Supabase que cree el usuario
    const { data, error } = await cliente.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { nombre: nombre },     // datos extra del usuario: guardamos el nombre
            emailRedirectTo: volverA
        }
    });

    // 4. Ver qué contestó
    if (error) {
        mensaje.textContent = traducirError(error.message);
    } else if (data.user && data.user.identities.length === 0) {
        // Supabase no avisa con error si el mail ya existe (por seguridad):
        // devuelve un usuario sin "identities"
        mensaje.textContent = 'Ese mail ya tiene una cuenta. Probá ingresar.';
    } else {
        mensaje.textContent = '¡Listo! Te mandamos un mail a ' + email +
                              '. Abrilo y confirmá tu cuenta para poder ingresar.';
    }
});

// Supabase contesta los errores en inglés: los pasamos a castellano
function traducirError(texto) {
    if (texto.includes('Password should be')) {
        return 'La contraseña es muy corta';
    }
    if (texto.includes('Unable to validate email') || texto.includes('invalid')) {
        return 'El mail no es válido';
    }
    if (texto.includes('rate limit')) {
        return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    }
    return 'Hubo un problema: ' + texto;   // cualquier otro, lo mostramos tal cual
}
