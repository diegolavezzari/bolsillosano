// ===== JS de nosotros.html =====

// Año en el pie: se actualiza solo
const anio = document.getElementById('anio');
anio.textContent = new Date().getFullYear();

// Navegador: se esconde al bajar y vuelve a aparecer al subir (igual que en index.js)
const navegador = document.querySelector('.navegador');
let anterior = window.scrollY;

window.addEventListener('scroll', function () {
    const actual = window.scrollY;

    if (actual > anterior && actual > 100) {
        navegador.classList.add('oculto');
    } else {
        navegador.classList.remove('oculto');
    }

    anterior = actual;
});


// ----- Si tiene la sesión abierta: navegador de adentro -----
// Usa "cliente", que viene de js/supabase.js (por eso ese archivo se carga antes).
// Sin sesión no se toca nada: queda el navegador público con "Ingresar"

async function revisarSesion() {
    const { data } = await cliente.auth.getSession();

    if (!data.session) {
        return;
    }

    // La misma clase que en inicio.html: 2 renglones en el celular, 1 en la compu
    navegador.classList.add('navegador-app');

    // El logo lleva al inicio de la app, no a la portada
    document.getElementById('marca').href = 'inicio.html';

    // Mostramos los 5 links de adentro
    const linksAdentro = document.querySelectorAll('.solo-adentro');
    for (const link of linksAdentro) {
        link.hidden = false;
    }

    // Cambiamos "Ingresar" por "Cerrar sesión"
    document.getElementById('btn-ingresar').hidden = true;
    document.getElementById('btn-salir').hidden = false;
}

revisarSesion();


// ----- Cerrar sesión (igual que en inicio.js) -----

const botonSalir = document.getElementById('btn-salir');

botonSalir.addEventListener('click', async function () {
    await cliente.auth.signOut();          // borra la sesión del navegador
    window.location.href = 'index.html';   // vuelve a la portada
});
