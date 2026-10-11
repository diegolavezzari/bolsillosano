// ===== JS de inversiones.html (test de perfil de inversor) =====

// Año en el pie: se actualiza solo
const anio = document.getElementById('anio');
anio.textContent = new Date().getFullYear();

// Test: al tocar el botón se suman los puntos y se muestra el perfil
const botonPerfil = document.getElementById('boton-perfil');
const aviso = document.getElementById('aviso');

// Los 3 resultados y el aviso del fondo de emergencia (arrancan ocultos)
const conservador = document.getElementById('perfil-conservador');
const moderado = document.getElementById('perfil-moderado');
const agresivo = document.getElementById('perfil-agresivo');
const sinFondo = document.getElementById('sin-fondo');

botonPerfil.addEventListener('click', function () {
    // :checked trae la opción marcada de cada pregunta.
    // Si no marcaron ninguna, querySelector devuelve null
    const p1 = document.querySelector('input[name="p1"]:checked');
    const p2 = document.querySelector('input[name="p2"]:checked');
    const p3 = document.querySelector('input[name="p3"]:checked');
    const p4 = document.querySelector('input[name="p4"]:checked');
    const p5 = document.querySelector('input[name="p5"]:checked');

    // Primero escondemos todo, por si ya habían hecho el test antes
    conservador.classList.remove('visible');
    moderado.classList.remove('visible');
    agresivo.classList.remove('visible');
    sinFondo.classList.remove('visible');

    // Si falta alguna (es null), avisamos y cortamos acá con return
    if (p1 === null || p2 === null || p3 === null || p4 === null || p5 === null) {
        aviso.textContent = 'Contestá todas las preguntas.';
        return;
    }
    aviso.textContent = '';

    // El value viene como texto: Number() lo pasa a número para poder sumar
    const puntos = Number(p1.value) + Number(p2.value) + Number(p3.value)
                 + Number(p4.value) + Number(p5.value);

    // Los puntos van de 5 a 15
    if (puntos <= 8) {
        conservador.classList.add('visible');
    } else if (puntos <= 11) {
        moderado.classList.add('visible');
    } else {
        agresivo.classList.add('visible');
    }

    // Si contestó "No" en la pregunta 4, primero el fondo de emergencia
    if (p4.value === '1') {
        sinFondo.classList.add('visible');
    }
});

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
