// ===== JS de amigos.html =====
// Usa "cliente", que viene de js/supabase.js (por eso ese archivo se carga antes)
//
// Cómo funciona un vínculo (tabla "vinculos"):
//   - de          = quien invita (se completa solo con su id)
//   - para_email  = el mail que escribió
//   - para        = el id del invitado: queda vacío hasta que acepta
//   - estado      = 'pendiente' o 'aceptado'
// RLS hace que cada uno vea solo los vínculos donde participa.


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


// ----- Quién soy (se completa al arrancar) -----

let miId = '';
let miEmail = '';


// ----- 1. Al abrir la página: ¿hay alguien logueado? -----

async function arrancar() {
    const { data } = await cliente.auth.getSession();

    if (!data.session) {
        window.location.href = 'login.html';
        return;
    }

    miId = data.session.user.id;
    miEmail = data.session.user.email.toLowerCase();

    cargarTodo();
}
arrancar();


// ----- 2. Traer los vínculos y repartirlos en las 3 listas -----

async function cargarTodo() {
    const { data: vinculos, error } = await cliente
        .from('vinculos')
        .select('*')
        .order('creado');

    if (error) {
        document.getElementById('mensaje').textContent = 'No se pudieron traer tus amigos. Probá de nuevo.';
        return;
    }

    // Los nombres de la gente con la que tengo un vínculo (RLS deja ver solo esos).
    // Armamos un objeto { id: nombre } para buscar el nombre rápido: nombres[id]
    const { data: perfiles } = await cliente.from('perfiles').select('user_id, nombre');
    const nombres = {};
    if (perfiles) {
        for (const p of perfiles) {
            nombres[p.user_id] = p.nombre;
        }
    }

    const listaRecibidas = document.getElementById('lista-recibidas');
    const listaAmigos = document.getElementById('lista-amigos');
    const listaEnviadas = document.getElementById('lista-enviadas');
    listaRecibidas.innerHTML = '';
    listaAmigos.innerHTML = '';
    listaEnviadas.innerHTML = '';

    // Contadores para saber si mostrar el "no tenés..." de cada lista
    let cantRecibidas = 0;
    let cantAmigos = 0;
    let cantEnviadas = 0;

    for (const v of vinculos) {
        if (v.estado === 'aceptado') {
            // Ya somos amigos. El amigo es "el otro": si yo invité, es "para"; si me invitaron, es "de"
            let idAmigo = v.de;
            if (v.de === miId) {
                idAmigo = v.para;
            }
            listaAmigos.appendChild(filaAmigo(v, nombres[idAmigo] || v.para_email));
            cantAmigos = cantAmigos + 1;

        } else if (v.de === miId) {
            // Pendiente y la mandé yo: espero que el otro acepte
            listaEnviadas.appendChild(filaEnviada(v));
            cantEnviadas = cantEnviadas + 1;

        } else {
            // Pendiente y me la mandaron a mí
            listaRecibidas.appendChild(filaRecibida(v, nombres[v.de] || 'Alguien'));
            cantRecibidas = cantRecibidas + 1;
        }
    }

    // hidden = true lo oculta, false lo muestra
    document.getElementById('recibidas-vacio').hidden = cantRecibidas > 0;
    document.getElementById('amigos-vacio').hidden = cantAmigos > 0;
    document.getElementById('enviadas-vacio').hidden = cantEnviadas > 0;
}


// ----- 3. Armar las filas -----
// Las 3 listas usan la misma fila: un título, un detalle chico y botones a la derecha.
// createElement + textContent (nunca innerHTML con lo que escribe el usuario)

function crearFila(titulo, detalle) {
    const fila = document.createElement('div');
    fila.className = 'social-fila';

    const datos = document.createElement('div');
    datos.className = 'social-datos';

    const t = document.createElement('p');
    t.className = 'social-nombre';
    t.textContent = titulo;
    datos.appendChild(t);

    const d = document.createElement('p');
    d.className = 'social-detalle';
    d.textContent = detalle;
    datos.appendChild(d);

    fila.appendChild(datos);
    return fila;
}

// Un botón chico. "gris" = true para el de borrar / rechazar (más suave)
function crearBoton(texto, gris) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = texto;
    if (gris) {
        boton.className = 'boton-chico boton-chico-gris';
    } else {
        boton.className = 'boton-chico';
    }
    return boton;
}

// Invitación que me llegó: Aceptar o Rechazar
function filaRecibida(v, nombre) {
    const fila = crearFila(nombre, 'Te invitó a su tribunal');

    const aceptar = crearBoton('Aceptar', false);
    aceptar.addEventListener('click', function () {
        aceptarInvitacion(v);
    });
    fila.appendChild(aceptar);

    const rechazar = crearBoton('Rechazar', true);
    rechazar.addEventListener('click', function () {
        borrarVinculo(v, '¿Rechazar la invitación de ' + nombre + '?');
    });
    fila.appendChild(rechazar);

    return fila;
}

// Amigo aceptado: Desvincular
function filaAmigo(v, nombre) {
    const fila = crearFila(nombre, 'En tu tribunal');

    const desvincular = crearBoton('Desvincular', true);
    desvincular.addEventListener('click', function () {
        borrarVinculo(v, '¿Sacar a ' + nombre + ' de tu tribunal? Ya no va a ver tus consultas.');
    });
    fila.appendChild(desvincular);

    return fila;
}

// Invitación que mandé y no aceptaron todavía: Cancelar
function filaEnviada(v) {
    const fila = crearFila(v.para_email, 'Esperando que acepte');

    const cancelar = crearBoton('Cancelar', true);
    cancelar.addEventListener('click', function () {
        borrarVinculo(v, '¿Cancelar la invitación a ' + v.para_email + '?');
    });
    fila.appendChild(cancelar);

    return fila;
}


// ----- 4. Invitar -----

const botonInvitar = document.getElementById('btn-invitar');

botonInvitar.addEventListener('click', async function () {
    const mensaje = document.getElementById('mensaje');

    // trim() saca los espacios de las puntas; toLowerCase() lo pasa a minúscula
    // (la base compara los mails en minúscula)
    const email = document.getElementById('email-amigo').value.trim().toLowerCase();

    if (email === '') {
        mensaje.textContent = 'Escribí el mail de tu amigo';
        return;
    }
    if (email === miEmail) {
        mensaje.textContent = 'Ese es tu propio mail 🙂';
        return;
    }

    // "de" se completa solo con mi id; estado arranca en 'pendiente'
    const { error } = await cliente.from('vinculos').insert({ para_email: email });

    if (error) {
        // 23505 = el código de Postgres para "ya existe" (la regla unique de la tabla)
        if (error.code === '23505') {
            mensaje.textContent = 'Ya invitaste a ese mail';
        } else {
            mensaje.textContent = 'No se pudo mandar la invitación. Probá de nuevo.';
        }
        return;
    }

    document.getElementById('email-amigo').value = '';
    mensaje.textContent = 'Listo, invitaste a ' + email + '. Cuando acepte, va a aparecer en tu tribunal.';
    cargarTodo();
});


// ----- 5. Aceptar una invitación -----

async function aceptarInvitacion(v) {
    // Se completa "para" con mi id: desde ahora el vínculo es de los dos
    const { error } = await cliente
        .from('vinculos')
        .update({ estado: 'aceptado', para: miId })
        .eq('id', v.id);

    if (error) {
        document.getElementById('mensaje').textContent = 'No se pudo aceptar. Probá de nuevo.';
        return;
    }

    cargarTodo();
}


// ----- 6. Rechazar, cancelar o desvincular (las 3 borran el vínculo) -----

async function borrarVinculo(v, pregunta) {
    const seguro = confirm(pregunta);
    if (!seguro) {
        return;
    }

    const { error } = await cliente
        .from('vinculos')
        .delete()
        .eq('id', v.id);

    if (error) {
        document.getElementById('mensaje').textContent = 'No se pudo borrar. Probá de nuevo.';
        return;
    }

    cargarTodo();
}


// ----- 7. Cerrar sesión -----

const botonSalir = document.getElementById('btn-salir');

botonSalir.addEventListener('click', async function () {
    await cliente.auth.signOut();
    window.location.href = 'index.html';
});
