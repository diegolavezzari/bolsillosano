// ===== JS de movimientos.html =====
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


// ----- Ayudas -----

// Formato de plata: 32000 → "$32.000"
function plata(numero) {
    return '$' + Number(numero).toLocaleString('es-AR');
}

// Arma una fecha como la guarda la base: "2026-11-05" (año-mes-día).
// padStart(2, '0') le agrega un 0 adelante si tiene un solo número: 5 → "05".
// getMonth() cuenta los meses desde 0 (enero = 0), por eso se le suma 1
function fechaTexto(anio, mes, dia) {
    return anio + '-' + String(mes + 1).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}

const hoy = new Date();

// Primer día de este mes y primer día del mes que viene:
// los movimientos "de este mes" son los que están entre esas dos fechas.
// (Si el mes es diciembre, new Date con mes 12 pasa solo a enero del año siguiente)
const primeroDelMes = fechaTexto(hoy.getFullYear(), hoy.getMonth(), 1);
const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
const primeroDelSiguiente = fechaTexto(siguiente.getFullYear(), siguiente.getMonth(), 1);

// El nombre del mes arriba de todo: "noviembre de 2026"
document.getElementById('mes-actual').textContent =
    hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

// El campo de fecha arranca con el día de hoy
document.getElementById('fecha').value = fechaTexto(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());


// ----- 1. Al abrir la página: ¿hay alguien logueado? -----

async function arrancar() {
    const { data } = await cliente.auth.getSession();

    if (!data.session) {
        //window.location.href = 'login.html';
        return;
    }

    cargarMovimientos();
}
arrancar();


// ----- 2. Traer los movimientos del mes, sumarlos y mostrarlos -----

async function cargarMovimientos() {
    // gte = "mayor o igual que", lt = "menor que".
    // order('fecha', { ascending: false }): los más nuevos primero
    const { data: movs, error } = await cliente
        .from('movimientos')
        .select('*')
        .gte('fecha', primeroDelMes)
        .lt('fecha', primeroDelSiguiente)
        .order('fecha', { ascending: false });

    if (error) {
        document.getElementById('mensaje').textContent = 'No se pudieron traer tus movimientos. Probá de nuevo.';
        return;
    }

    // Recorremos y sumamos: los ingresos por un lado, los gastos por otro.
    // Las compras evitadas ('evitado') no se suman a ninguno: es plata que no se movió
    let ingresos = 0;
    let gastos = 0;
    let ahorrado = 0;   // lo que pasaste a metas este mes: 'ahorro' suma, 'retiro' resta (se cargan desde metas.html)
    for (const m of movs) {
        if (m.tipo === 'ingreso') {
            ingresos = ingresos + Number(m.monto);
        }
        if (m.tipo === 'gasto') {
            gastos = gastos + Number(m.monto);
        }
        if (m.tipo === 'ahorro') {
            ahorrado = ahorrado + Number(m.monto);
        }
        if (m.tipo === 'retiro') {
            ahorrado = ahorrado - Number(m.monto);
        }
    }

    // Lo que queda para ahorrar = lo que entró − lo que salió − lo que ya separaste
    const paraAhorrar = ingresos - gastos - ahorrado;

    document.getElementById('total-ingresos').textContent = plata(ingresos);
    document.getElementById('total-gastos').textContent = plata(gastos);
    document.getElementById('para-ahorrar').textContent = plata(paraAhorrar);
    // Si este mes sacaste más de lo que pusiste, el número da negativo: lo decimos al revés
    const textoAhorrado = document.getElementById('texto-ahorrado');
    if (ahorrado >= 0) {
        textoAhorrado.textContent = 'Ya separaste ' + plata(ahorrado) + ' para tus metas';
    } else {
        textoAhorrado.textContent = 'Sacaste ' + plata(-ahorrado) + ' de tus metas';
    }

    // La lista de abajo
    const lista = document.getElementById('lista-movs');
    lista.innerHTML = '';

    // hidden = true lo oculta, false lo muestra
    if (movs.length === 0) {
        document.getElementById('movs-vacio').hidden = false;
    } else {
        document.getElementById('movs-vacio').hidden = true;
    }

    for (const m of movs) {
        lista.appendChild(crearFila(m));
    }
}


// ----- 3. Armar la fila de UN movimiento -----
// Igual que en metas.js: createElement + textContent (nunca innerHTML con lo que escribe el usuario)

function crearFila(m) {
    const fila = document.createElement('div');
    fila.className = 'mov-fila';

    // Izquierda: descripción (o la categoría si no puso descripción) y abajo la fecha
    const datos = document.createElement('div');

    const titulo = document.createElement('p');
    titulo.className = 'mov-titulo';
    if (m.descripcion) {
        titulo.textContent = m.descripcion;
    } else {
        titulo.textContent = m.categoria;
    }
    datos.appendChild(titulo);

    // La fecha viene "2026-11-05": split('-') la corta en ["2026", "11", "05"]
    // y la damos vuelta para mostrarla como "05/11"
    const partes = m.fecha.split('-');
    const detalle = document.createElement('p');
    detalle.className = 'mov-detalle';
    detalle.textContent = partes[2] + '/' + partes[1] + ' · ' + m.categoria;
    datos.appendChild(detalle);

    fila.appendChild(datos);

    // Derecha: el monto y el botón Borrar.
    // Ingreso: verde con +. Gasto: rojo con −. Compra evitada: azul, sin signo
    // (no entró ni salió plata: es la que NO gastaste)
    const monto = document.createElement('p');
    if (m.tipo === 'ingreso') {
        monto.className = 'mov-monto mov-ingreso';
        monto.textContent = '+ ' + plata(m.monto);
    } else if (m.tipo === 'evitado') {
        monto.className = 'mov-monto mov-evitado';
        monto.textContent = plata(m.monto) + ' evitado';
    } else if (m.tipo === 'retiro') {
        // Retiro: plata que sacaste de una meta (vuelve a lo que te queda del mes)
        monto.className = 'mov-monto mov-ahorro';
        monto.textContent = '← ' + plata(m.monto) + ' de tu meta';
    } else if (m.tipo === 'ahorro') {
        // Ahorro: plata que pasaste a una meta (la descripción es el nombre de la meta)
        monto.className = 'mov-monto mov-ahorro';
        monto.textContent = '→ ' + plata(m.monto) + ' a tu meta';
    } else {
        monto.className = 'mov-monto mov-gasto';
        monto.textContent = '− ' + plata(m.monto);
    }
    fila.appendChild(monto);

    const botonBorrar = document.createElement('button');
    botonBorrar.type = 'button';
    botonBorrar.className = 'mov-borrar';
    botonBorrar.textContent = 'Borrar';
    botonBorrar.addEventListener('click', function () {
        borrarMovimiento(m);
    });
    fila.appendChild(botonBorrar);

    return fila;
}


// ----- 4. Guardar un movimiento nuevo -----

const botonGuardar = document.getElementById('btn-guardar');

botonGuardar.addEventListener('click', async function () {
    const tipo = document.getElementById('tipo').value;
    const monto = document.getElementById('monto').value;
    const descripcion = document.getElementById('descripcion').value;
    const categoria = document.getElementById('categoria').value;
    const fecha = document.getElementById('fecha').value;
    const mensaje = document.getElementById('mensaje');

    if (monto === '' || Number(monto) <= 0) {
        mensaje.textContent = 'Escribí el monto';
        return;
    }
    if (fecha === '') {
        mensaje.textContent = 'Elegí la fecha';
        return;
    }

    // user_id se completa solo en la base (default auth.uid())
    const { error } = await cliente.from('movimientos').insert({
        tipo: tipo,
        monto: Number(monto),
        descripcion: descripcion,
        categoria: categoria,
        fecha: fecha
    });

    if (error) {
        mensaje.textContent = 'No se pudo guardar. Probá de nuevo.';
        return;
    }

    // Salió bien: vaciamos monto y descripción (tipo, categoría y fecha quedan,
    // así es más rápido cargar varios gastos seguidos)
    document.getElementById('monto').value = '';
    document.getElementById('descripcion').value = '';

    if (tipo === 'ingreso') {
        mensaje.textContent = 'Guardaste un ingreso de ' + plata(monto);
    } else if (tipo === 'evitado') {
        mensaje.textContent = '¡Bien! Evitaste gastar ' + plata(monto);
    } else {
        mensaje.textContent = 'Guardaste un gasto de ' + plata(monto);
    }

    // Si la fecha es de otro mes, se guarda igual pero no aparece en esta lista
    if (fecha < primeroDelMes || fecha >= primeroDelSiguiente) {
        mensaje.textContent = mensaje.textContent + ' (es de otro mes: no se suma en este resumen)';
    }

    cargarMovimientos();
});


// ----- 5. Borrar un movimiento -----

async function borrarMovimiento(m) {
    let pregunta = '¿Borrar este movimiento de ' + plata(m.monto) + '?';
    if (m.tipo === 'ahorro') {
        pregunta = '¿Sacar ' + plata(m.monto) + ' de tu meta "' + m.descripcion + '"? Vuelven a lo que te queda del mes.';
    }
    if (m.tipo === 'retiro') {
        pregunta = '¿Devolver ' + plata(m.monto) + ' a tu meta "' + m.descripcion + '"? Se descuentan de lo que te queda del mes.';
    }
    const seguro = confirm(pregunta);
    if (!seguro) {
        return;
    }

    const mensaje = document.getElementById('mensaje');

    // Si es un ahorro o un retiro, primero arreglamos su meta (para que la meta y el flujo no queden distintos):
    //   borrar un ahorro → se le resta a la meta;  borrar un retiro → se le vuelve a sumar
    if ((m.tipo === 'ahorro' || m.tipo === 'retiro') && m.meta_id) {
        const { data: meta } = await cliente
            .from('metas')
            .select('ahorrado')
            .eq('id', m.meta_id)
            .single();          // single = esperamos UNA fila, no una lista

        if (meta) {
            let nuevoAhorrado = Number(meta.ahorrado) + Number(m.monto);   // retiro: vuelve a la meta
            if (m.tipo === 'ahorro') {
                // Math.max(0, ...) = nunca menos de 0
                nuevoAhorrado = Math.max(0, Number(meta.ahorrado) - Number(m.monto));
            }
            const { error: errorMeta } = await cliente
                .from('metas')
                .update({ ahorrado: nuevoAhorrado })
                .eq('id', m.meta_id);

            if (errorMeta) {
                mensaje.textContent = 'No se pudo actualizar la meta. Probá de nuevo.';
                return;
            }
        }
    }

    const { error } = await cliente
        .from('movimientos')
        .delete()
        .eq('id', m.id);

    if (error) {
        mensaje.textContent = 'No se pudo borrar. Probá de nuevo.';
        return;
    }

    cargarMovimientos();
}


// ----- 6. Cerrar sesión -----

const botonSalir = document.getElementById('btn-salir');

botonSalir.addEventListener('click', async function () {
    await cliente.auth.signOut();
    window.location.href = 'index.html';
});
