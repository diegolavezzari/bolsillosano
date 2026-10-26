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
