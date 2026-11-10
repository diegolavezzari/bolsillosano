// ===== JS de inicio.html =====
// Usa "cliente", que viene de js/supabase.js (por eso ese archivo se carga antes)


// ----- Año en el pie: se actualiza solo -----

const anio = document.getElementById('anio');
anio.textContent = new Date().getFullYear();


// ----- Navegador: se esconde al bajar y vuelve a aparecer al subir (igual que en index.js) -----

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


// ----- Ayudas (las mismas que en movimientos.js) -----

// Formato de plata: 32000 → "$32.000"
function plata(numero) {
    return '$' + Number(numero).toLocaleString('es-AR');
}

// Fecha como la guarda la base: "2026-11-05". getMonth() empieza en 0, por eso + 1
function fechaTexto(anio, mes, dia) {
    return anio + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}


// ----- 1. Al abrir la página: ¿hay alguien logueado? -----

async function arrancar() {
    const { data } = await cliente.auth.getSession();

    if (!data.session) {
        // ! significa "no": si NO hay sesión, afuera
        window.location.href = 'login.html';
        return;
    }

    // Hay sesión: mostrar el nombre que guardamos al registrarse
    const usuario = data.session.user;
    document.getElementById('nombre-usuario').textContent = usuario.user_metadata.nombre;

    // Y traer los datos de las tarjetas
    cargarMetas();
    cargarFlujo();
    revisarTribunal(usuario.id);
}
arrancar();


// ----- 2. Tarjeta "Tus metas": todas las metas, cada una con su barra -----

async function cargarMetas() {
    // RLS hace que vengan solo las metas de este usuario
    const { data: metas, error } = await cliente
        .from('metas')
        .select('*')
        .order('creada');

    if (error) {
        return;   // si falla, la tarjeta queda como "Todavía no tenés metas"
    }

    const lista = document.getElementById('lista-metas');
    lista.innerHTML = '';

    if (metas.length === 0) {
        // Sin metas: se ve el texto de "Todavía no tenés metas" y el botón dice "Crear una meta"
        document.getElementById('metas-vacio').hidden = false;
        document.getElementById('link-metas').textContent = 'Crear una meta';
        return;
    }

    document.getElementById('metas-vacio').hidden = true;
    document.getElementById('link-metas').textContent = 'Ver mis metas';

    // Una "mini meta" por cada una: nombre, montos, barra y %.
    // Igual que en metas.js: createElement + textContent (nunca innerHTML con lo que escribe el usuario)
    for (const meta of metas) {
        const porcentaje = Math.round(meta.ahorrado / meta.objetivo * 100);

        const caja = document.createElement('div');
        caja.className = 'meta-mini';

        const titulo = document.createElement('h3');
        titulo.textContent = meta.nombre;
        caja.appendChild(titulo);

        const montos = document.createElement('p');
        montos.textContent = plata(meta.ahorrado) + ' de ' + plata(meta.objetivo);
        caja.appendChild(montos);

        // Barra: mismas clases que en metas.html
        const barra = document.createElement('div');
        barra.className = 'barra';
        const relleno = document.createElement('div');
        relleno.className = 'barra-relleno';
        relleno.style.width = Math.min(porcentaje, 100) + '%';   // nunca más del 100%
        barra.appendChild(relleno);
        caja.appendChild(barra);

        const texto = document.createElement('p');
        texto.className = 'barra-texto';
        texto.textContent = porcentaje + '%';
        caja.appendChild(texto);

        lista.appendChild(caja);
    }
}


// ----- 3. Tarjetas "Disponible este mes" y "Tu resumen" (salen de Flujo) -----

async function cargarFlujo() {
    const hoy = new Date();
    const primeroDelMes = fechaTexto(hoy.getFullYear(), hoy.getMonth(), 1);
    const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const primeroDelSiguiente = fechaTexto(siguiente.getFullYear(), siguiente.getMonth(), 1);

    // Disponible: solo los movimientos de este mes (gte = desde, lt = antes de)
    const { data: delMes, error } = await cliente
        .from('movimientos')
        .select('tipo, monto')
        .gte('fecha', primeroDelMes)
        .lt('fecha', primeroDelSiguiente);

    if (!error) {
        let disponible = 0;
        for (const m of delMes) {
            if (m.tipo === 'ingreso') {
                disponible = disponible + Number(m.monto);
            }
            // Gastos y lo que pasaste a metas ('ahorro') restan
            if (m.tipo === 'gasto' || m.tipo === 'ahorro') {
                disponible = disponible - Number(m.monto);
            }
            // Lo que sacaste de una meta ('retiro') vuelve al disponible
            if (m.tipo === 'retiro') {
                disponible = disponible + Number(m.monto);
            }
        }
        document.getElementById('disponible').textContent = plata(disponible);
    }

    // Resumen: TODAS las compras evitadas (no solo las del mes).
    // .eq('tipo', 'evitado') = solo las filas con ese tipo
    const { data: evitadas, error: error2 } = await cliente
        .from('movimientos')
        .select('monto')
        .eq('tipo', 'evitado');

    if (!error2) {
        let protegido = 0;
        for (const m of evitadas) {
            protegido = protegido + Number(m.monto);
        }
        document.getElementById('compras-evitadas').textContent = evitadas.length;
        document.getElementById('dinero-protegido').textContent = plata(protegido);
    }
}


// ----- 3b. Aviso "Tenés N consultas del tribunal" -----
// Cuenta las compras de mis amigos que siguen abiertas y que yo todavía no voté

async function revisarTribunal(miId) {
    // Consultas abiertas que NO son mías (neq = "distinto de").
    // RLS hace que vengan solo las de mis amigos aceptados
    const { data: abiertas, error } = await cliente
        .from('consultas')
        .select('id')
        .eq('estado', 'abierta')
        .neq('user_id', miId);

    // Mis votos: para saber cuáles ya voté
    const { data: misVotos, error: error2 } = await cliente
        .from('votos')
        .select('consulta_id')
        .eq('user_id', miId);

    if (error || error2) {
        return;   // si falla, el aviso queda oculto
    }

    // Contamos las abiertas que no aparecen en mis votos.
    // some devuelve true si ALGUNO de la lista cumple la condición
    let pendientes = 0;
    for (const c of abiertas) {
        const yaVote = misVotos.some(function (v) {
            return v.consulta_id === c.id;
        });
        if (!yaVote) {
            pendientes = pendientes + 1;
        }
    }

    if (pendientes > 0) {
        const aviso = document.getElementById('aviso-tribunal');
        if (pendientes === 1) {
            aviso.textContent = '⚖️ Tenés 1 consulta del tribunal esperando tu voto →';
        } else {
            aviso.textContent = '⚖️ Tenés ' + pendientes + ' consultas del tribunal esperando tu voto →';
        }
        aviso.hidden = false;
    }
}


// ----- 4. Cerrar sesión -----

const botonSalir = document.getElementById('btn-salir');

botonSalir.addEventListener('click', async function () {
    await cliente.auth.signOut();          // borra la sesión del navegador
    window.location.href = 'index.html';   // vuelve a la portada
});


// ----- 5. Borrar mi cuenta -----
// Con la key pública el navegador NO puede borrar usuarios. Por eso se llama a una
// función de la base, borrar_mi_cuenta(), que borra al que la llama y solo a él.
// Al borrar el usuario, la base borra sola sus metas y su flujo (on delete cascade)

const botonBorrar = document.getElementById('btn-borrar-cuenta');

botonBorrar.addEventListener('click', async function () {
    // confirm muestra un cartel con Aceptar / Cancelar y devuelve true o false
    const seguro = confirm('¿Seguro? Se borran tu cuenta, tus metas y tu flujo. No se puede deshacer.');
    if (!seguro) {
        return;   // apretó Cancelar: no hacemos nada
    }

    // rpc = "llamar a una función de la base"
    const { error } = await cliente.rpc('borrar_mi_cuenta');

    if (error) {
        alert('No se pudo borrar la cuenta: ' + error.message);
        return;
    }

    // El usuario ya no existe en Supabase: solo falta borrar la sesión de este navegador.
    // scope: 'local' = borrarla acá sin preguntarle a Supabase (que ya no conoce a este usuario)
    await cliente.auth.signOut({ scope: 'local' });
    alert('Tu cuenta y todos tus datos se borraron.');
    window.location.href = 'index.html';   // vuelve a la portada
});
