// ===== JS de metas.html =====
// Usa "cliente", que viene de js/supabase.js (por eso ese archivo se carga antes)


// ----- Año en el pie y navegador que se esconde (igual que en inicio.js) -----

const anio = document.getElementById('anio');
anio.textContent = new Date().getFullYear();

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


// ----- Formato de plata: 750000 → "$750.000" -----
// toLocaleString('es-AR') pone los puntos de los miles como se usa en Argentina

function plata(numero) {
    return '$' + Number(numero).toLocaleString('es-AR');
}


// Fecha como la guarda la base: "2026-11-05". getMonth() empieza en 0, por eso + 1
function fechaTexto(anio, mes, dia) {
    return anio + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}

// Lo que queda para ahorrar este mes (se actualiza en calcularDisponible)
let disponible = 0;


// ----- 1. Al abrir la página: ¿hay alguien logueado? -----

async function arrancar() {
    const { data } = await cliente.auth.getSession();

    if (!data.session) {
        // ! significa "no": si NO hay sesión, afuera
        window.location.href = 'login.html';
        return;
    }

    // Hay sesión: traemos sus metas y lo que le queda del mes
    cargarMetas();
    calcularDisponible();
}
arrancar();


// ----- 2. Traer mis metas de Supabase y mostrarlas -----

async function cargarMetas() {
    // RLS hace que vengan SOLO las metas del usuario logueado.
    // order('creada'): de la más vieja a la más nueva
    const { data: metas, error } = await cliente
        .from('metas')
        .select('*')
        .order('creada');

    if (error) {
        document.getElementById('mensaje-lista').textContent = 'No se pudieron traer tus metas. Probá de nuevo.';
        return;
    }

    const lista = document.getElementById('lista-metas');
    const vacio = document.getElementById('metas-vacio');

    // Vaciamos la lista antes de llenarla, así no se repiten las tarjetas al recargar
    lista.innerHTML = '';

    // hidden = true lo oculta, false lo muestra
    if (metas.length === 0) {
        vacio.hidden = false;
    } else {
        vacio.hidden = true;
    }

    // Una tarjeta por cada meta
    for (const meta of metas) {
        lista.appendChild(crearTarjeta(meta));
    }
}


// ----- 3. Armar la tarjeta de UNA meta -----
// createElement crea una etiqueta nueva; appendChild la mete adentro de otra.
// Usamos textContent (y no innerHTML) para el nombre: así, si alguien escribe
// "<b>hola</b>" como meta, se ve el texto tal cual y no se interpreta como HTML.

function crearTarjeta(meta) {
    // El % se calcula, no se guarda en la base
    const porcentaje = Math.round(meta.ahorrado / meta.objetivo * 100);

    const tarjeta = document.createElement('div');
    tarjeta.className = 'meta-tarjeta';

    const titulo = document.createElement('h3');
    titulo.textContent = meta.nombre;
    tarjeta.appendChild(titulo);

    const montos = document.createElement('p');
    montos.textContent = plata(meta.ahorrado) + ' de ' + plata(meta.objetivo);
    tarjeta.appendChild(montos);

    // Barra de progreso: la caja de fondo y el relleno adentro (mismas clases que en inicio.html)
    const barra = document.createElement('div');
    barra.className = 'barra';
    const relleno = document.createElement('div');
    relleno.className = 'barra-relleno';
    // Math.min: si ahorraste más que el objetivo, la barra no pasa del 100%
    relleno.style.width = Math.min(porcentaje, 100) + '%';
    barra.appendChild(relleno);
    tarjeta.appendChild(barra);

    const textoPorcentaje = document.createElement('p');
    textoPorcentaje.className = 'barra-texto';
    textoPorcentaje.textContent = porcentaje + '%';
    tarjeta.appendChild(textoPorcentaje);

    // Sumar ahorro: un campo para el monto y un botón
    const acciones = document.createElement('div');
    acciones.className = 'meta-acciones';

    const campoAhorro = document.createElement('input');
    campoAhorro.type = 'number';
    campoAhorro.min = '1';
    campoAhorro.placeholder = 'Monto';
    campoAhorro.setAttribute('aria-label', 'Monto para sumar o restar de ' + meta.nombre);
    acciones.appendChild(campoAhorro);

    const botonSumar = document.createElement('button');
    botonSumar.type = 'button';
    botonSumar.className = 'tarjeta-boton';
    botonSumar.textContent = 'Sumar ahorro';
    acciones.appendChild(botonSumar);

    // Restar: sacar un poco de plata de la meta sin borrarla (usa el mismo campo del monto)
    const botonRestar = document.createElement('button');
    botonRestar.type = 'button';
    botonRestar.className = 'tarjeta-boton';
    botonRestar.textContent = 'Restar ahorro';
    acciones.appendChild(botonRestar);

    const botonBorrar = document.createElement('button');
    botonBorrar.type = 'button';
    botonBorrar.className = 'tarjeta-boton meta-borrar';
    botonBorrar.textContent = 'Borrar meta';
    acciones.appendChild(botonBorrar);

    tarjeta.appendChild(acciones);

    // Cada botón "se acuerda" de SU meta (meta.id), porque se crea adentro de esta función
    botonSumar.addEventListener('click', function () {
        sumarAhorro(meta, campoAhorro.value);
    });

    botonRestar.addEventListener('click', function () {
        restarAhorro(meta, campoAhorro.value);
    });

    botonBorrar.addEventListener('click', function () {
        borrarMeta(meta);
    });

    return tarjeta;
}


// ----- 3b. Lo que queda para ahorrar este mes -----
// Igual que en Flujo: ingresos − gastos − lo que pasaste a metas ('ahorro')
//                   + lo que sacaste de metas ('retiro')

async function calcularDisponible() {
    const hoy = new Date();
    const primeroDelMes = fechaTexto(hoy.getFullYear(), hoy.getMonth(), 1);
    const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    const primeroDelSiguiente = fechaTexto(siguiente.getFullYear(), siguiente.getMonth(), 1);

    const { data: movs, error } = await cliente
        .from('movimientos')
        .select('tipo, monto')
        .gte('fecha', primeroDelMes)
        .lt('fecha', primeroDelSiguiente);

    if (error) {
        return;
    }

    disponible = 0;
    for (const m of movs) {
        if (m.tipo === 'ingreso') {
            disponible = disponible + Number(m.monto);
        }
        if (m.tipo === 'gasto' || m.tipo === 'ahorro') {
            disponible = disponible - Number(m.monto);
        }
        if (m.tipo === 'retiro') {
            disponible = disponible + Number(m.monto);   // la plata volvió de una meta
        }
    }

    document.getElementById('disponible-metas').textContent = plata(disponible);
}


// ----- 4. Sumar plata a una meta -----
// Hace 2 cosas: guarda un movimiento 'ahorro' en el flujo (así esa plata se descuenta
// de lo que te queda del mes) y sube el "ahorrado" de la meta.
// El movimiento lleva meta_id: así la base sabe de qué meta es (ver borrarMeta)

async function sumarAhorro(meta, monto) {
    const mensaje = document.getElementById('mensaje-lista');

    if (monto === '' || Number(monto) <= 0) {
        mensaje.textContent = 'Escribí cuánto querés sumar a "' + meta.nombre + '"';
        return;
    }

    // No se puede ahorrar más de lo que queda del mes: el disponible no puede quedar negativo
    if (disponible <= 0) {
        mensaje.textContent = 'Este mes no te queda plata para ahorrar. Cargá tus ingresos en Flujo.';
        return;
    }
    if (Number(monto) > disponible) {
        mensaje.textContent = 'No te alcanza: este mes te quedan ' + plata(disponible) + ' para ahorrar.';
        return;
    }

    // 1. Guardar el movimiento 'ahorro' (fecha: hoy, se completa sola).
    //    Va primero: si falla, no tocamos la meta y no queda nada a medias
    const { error } = await cliente.from('movimientos').insert({
        tipo: 'ahorro',
        descripcion: meta.nombre,
        categoria: 'Ahorro',
        monto: Number(monto),
        meta_id: meta.id
    });

    if (error) {
        // Si pasa esto, casi seguro falta correr el SQL que agrega 'ahorro' y meta_id a la tabla
        mensaje.textContent = 'No se pudo guardar el ahorro. (' + error.message + ')';
        return;
    }

    // 2. Subir la meta: lo nuevo = lo que ya tenía + lo que escribiste
    const nuevoAhorrado = Number(meta.ahorrado) + Number(monto);

    // .eq('id', meta.id) = "solo la fila con este id"
    const { error: error2 } = await cliente
        .from('metas')
        .update({ ahorrado: nuevoAhorrado })
        .eq('id', meta.id);

    if (error2) {
        mensaje.textContent = 'Se descontó del flujo pero no se pudo sumar a la meta. Probá de nuevo.';
    } else {
        mensaje.textContent = 'Sumaste ' + plata(monto) + ' a "' + meta.nombre + '"';
    }

    cargarMetas();          // volvemos a traer las metas para ver la barra actualizada
    calcularDisponible();   // y lo que queda del mes
}


// ----- 4b. Restar plata de una meta (sin borrarla) -----
// Lo contrario de sumarAhorro: guarda un movimiento 'retiro' (esa plata vuelve a lo
// que te queda del mes en Flujo) y baja el "ahorrado" de la meta

async function restarAhorro(meta, monto) {
    const mensaje = document.getElementById('mensaje-lista');

    if (monto === '' || Number(monto) <= 0) {
        mensaje.textContent = 'Escribí cuánto querés sacar de "' + meta.nombre + '"';
        return;
    }

    // No se puede sacar más de lo que la meta tiene ahorrado (no puede quedar negativa)
    if (Number(monto) > Number(meta.ahorrado)) {
        mensaje.textContent = 'No podés sacar más de lo que tiene: "' + meta.nombre + '" tiene ' + plata(meta.ahorrado) + '.';
        return;
    }

    // 1. Guardar el movimiento 'retiro', con el meta_id igual que los ahorros
    const { error } = await cliente.from('movimientos').insert({
        tipo: 'retiro',
        descripcion: meta.nombre,
        categoria: 'Ahorro',
        monto: Number(monto),
        meta_id: meta.id
    });

    if (error) {
        // Si pasa esto, casi seguro falta aplicar la migración que agrega 'retiro'
        mensaje.textContent = 'No se pudo sacar el ahorro. (' + error.message + ')';
        return;
    }

    // 2. Bajar la meta: lo nuevo = lo que tenía − lo que sacás
    const nuevoAhorrado = Number(meta.ahorrado) - Number(monto);

    const { error: error2 } = await cliente
        .from('metas')
        .update({ ahorrado: nuevoAhorrado })
        .eq('id', meta.id);

    if (error2) {
        mensaje.textContent = 'Se devolvió al flujo pero no se pudo restar de la meta. Probá de nuevo.';
    } else {
        mensaje.textContent = 'Sacaste ' + plata(monto) + ' de "' + meta.nombre + '". Volvieron a lo que te queda del mes.';
    }

    cargarMetas();
    calcularDisponible();
}


// ----- 5. Borrar una meta -----
// Al borrar la meta, la base borra sola sus movimientos 'ahorro' y 'retiro' (meta_id con
// "on delete cascade"): lo que tenía ahorrado vuelve a lo que te queda del mes en Flujo

async function borrarMeta(meta) {
    // confirm muestra una ventanita con Aceptar / Cancelar
    let pregunta = '¿Borrar la meta "' + meta.nombre + '"?';
    if (Number(meta.ahorrado) > 0) {
        pregunta = pregunta + ' Los ' + plata(meta.ahorrado) + ' que le sumaste vuelven a tu flujo.';
    }
    const seguro = confirm(pregunta);
    if (!seguro) {
        return;
    }

    const { error } = await cliente
        .from('metas')
        .delete()
        .eq('id', meta.id);

    const mensaje = document.getElementById('mensaje-lista');

    if (error) {
        mensaje.textContent = 'No se pudo borrar la meta. Probá de nuevo.';
        return;
    }

    mensaje.textContent = 'Borraste "' + meta.nombre + '"';
    cargarMetas();
    calcularDisponible();   // la plata de esa meta volvió al disponible
}


// ----- 6. Guardar las metas nuevas (solo los lugares completados) -----

const botonGuardar = document.getElementById('btn-guardar');

botonGuardar.addEventListener('click', async function () {
    const mensaje = document.getElementById('mensaje');

    // Recorremos los 5 lugares y juntamos en un array los que tienen nombre y objetivo
    const nuevas = [];
    for (let i = 1; i <= 5; i++) {
        const nombre = document.getElementById('meta-nombre-' + i).value;
        const objetivo = document.getElementById('meta-objetivo-' + i).value;

        if (nombre !== '' && objetivo !== '' && Number(objetivo) > 0) {
            nuevas.push({ nombre: nombre, objetivo: Number(objetivo) });
        }
    }

    if (nuevas.length === 0) {
        mensaje.textContent = 'Completá al menos una meta con nombre y objetivo';
        return;
    }

    // Se insertan todas juntas. user_id se completa solo en la base (default auth.uid())
    const { error } = await cliente.from('metas').insert(nuevas);

    if (error) {
        mensaje.textContent = 'No se pudieron guardar las metas. Probá de nuevo.';
        return;
    }

    // Salió bien: vaciamos los 5 lugares y recargamos la lista
    for (let i = 1; i <= 5; i++) {
        document.getElementById('meta-nombre-' + i).value = '';
        document.getElementById('meta-objetivo-' + i).value = '';
    }

    if (nuevas.length === 1) {
        mensaje.textContent = 'Guardaste 1 meta';
    } else {
        mensaje.textContent = 'Guardaste ' + nuevas.length + ' metas';
    }
    cargarMetas();
});


// ----- 7. Cerrar sesión -----

const botonSalir = document.getElementById('btn-salir');

botonSalir.addEventListener('click', async function () {
    await cliente.auth.signOut();          // borra la sesión del navegador
    window.location.href = 'index.html';   // vuelve a la portada
});
