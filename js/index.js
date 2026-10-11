// ===== JS de index.html (bienvenida) =====

// Año en el pie: se actualiza solo
const anio = document.getElementById('anio');
anio.textContent = new Date().getFullYear();

// Tarjetas: el botón "Ver más" abre y cierra el texto extra.
// querySelectorAll trae TODOS los botones con esa clase (una lista).
const botones = document.querySelectorAll('.tarjeta-boton');

// Recorremos la lista y a cada botón le agregamos su evento
for (const boton of botones) {
    boton.addEventListener('click', function () {
        // parentElement = la tarjeta que contiene a este botón
        const tarjeta = boton.parentElement;

        // toggle: si la tarjeta no tiene la clase "abierta" se la pone,
        // y si ya la tiene se la saca. El CSS muestra u oculta el texto.
        tarjeta.classList.toggle('abierta');

        if (tarjeta.classList.contains('abierta')) {
            boton.textContent = 'Ver menos';
        } else {
            boton.textContent = 'Ver más';
        }
    });
}

// Navegador: se esconde al bajar y vuelve a aparecer al subir.
const navegador = document.querySelector('.navegador');

// Guardamos cuánto estaba bajada la página la vez anterior
let anterior = window.scrollY;

// El evento "scroll" se dispara cada vez que la página se mueve
window.addEventListener('scroll', function () {
    // scrollY = cuántos píxeles bajaste desde arriba de todo
    const actual = window.scrollY;

    // Si el número creció, estás bajando (y ya pasaste los primeros 100px)
    if (actual > anterior && actual > 100) {
        navegador.classList.add('oculto');
    } else {
        navegador.classList.remove('oculto');
    }

    anterior = actual;
});
